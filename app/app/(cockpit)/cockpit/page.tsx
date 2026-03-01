"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { PageFrame } from "@/components/layout/PageFrame";
import { fetchJson } from "@/lib/coreFetch";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";

const SHIFT_OPTIONS = ["Day", "Evening", "Night"] as const;

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

type Verdict = "GO" | "WARNING" | "NO-GO";

function verdictFromSummary(s: CockpitSummaryResponse): Verdict {
  if (s.active_blocking > 0) return "NO-GO";
  if (s.active_nonblocking > 0) return "WARNING";
  return "GO";
}

function countByType(byType: Array<{ type: string; count: number }> | undefined, type: string): number {
  if (!byType?.length) return 0;
  const row = byType.find((r) => r.type === type);
  return row?.count ?? 0;
}

type RiskLevel = "STABLE" | "ELEVATED" | "CRITICAL";

function riskLegal(summary: CockpitSummaryResponse | null): { level: RiskLevel; count: number } {
  if (!summary) return { level: "STABLE", count: 0 };
  const critical_count = countByType(summary.by_type, "ILLEGAL") + countByType(summary.by_type, "GOVERNANCE");
  return {
    count: critical_count,
    level: critical_count > 0 ? "CRITICAL" : "STABLE",
  };
}

function riskStaffing(summary: CockpitSummaryResponse | null): { level: RiskLevel; count: number } {
  if (!summary) return { level: "STABLE", count: 0 };
  const unstaffed = countByType(summary.by_type, "UNSTAFFED");
  const blocking = summary.active_blocking ?? 0;
  const count = unstaffed + blocking;
  let level: RiskLevel = "STABLE";
  if (blocking > 0) level = "CRITICAL";
  else if (unstaffed > 0) level = "ELEVATED";
  return { level, count };
}

function riskDrift(summary: CockpitSummaryResponse | null): { level: RiskLevel; count: number } {
  if (!summary) return { level: "STABLE", count: 0 };
  const count = summary.active_nonblocking ?? 0;
  return { level: count > 0 ? "ELEVATED" : "STABLE", count };
}

function issueSummary(issue: CockpitIssueRow): string {
  const t = (issue as Record<string, unknown>).title as string | undefined;
  const r = (issue as Record<string, unknown>).reason as string | undefined;
  const m = (issue as Record<string, unknown>).message as string | undefined;
  return t ?? r ?? m ?? issue.recommended_action ?? "—";
}

function incidentCardLines(issue: CockpitIssueRow): { line1: string; line2: string } {
  const what = (issue.type || issue.issue_type || "INCIDENT").toString().trim();
  const stationCode = (issue.station_code ?? "").toString().trim();
  const stationName = (issue.station_name ?? "").toString().trim();
  const where = stationCode
    ? (stationName ? `${stationCode} (${stationName})` : stationCode)
    : "—";
  const who = (issue as Record<string, unknown>).employee_name as string | undefined;
  const reasonCodes = (issue as Record<string, unknown>).reason_codes as string[] | undefined;
  const why =
    (reasonCodes?.[0] as string | undefined) ??
    ((issue as Record<string, unknown>).reason as string | undefined) ??
    ((issue as Record<string, unknown>).message as string | undefined) ??
    ((issue as Record<string, unknown>).title as string | undefined) ??
    "";
  const line2Parts: string[] = [];
  if (who) line2Parts.push("Employee: " + who);
  if (why) line2Parts.push(why);
  const line2 = line2Parts.join(" • ") || "";
  return { line1: `${what} • ${where}`, line2: line2.trim() };
}

type IncidentFilterType = "ALL" | "ILLEGAL" | "UNSTAFFED" | "GOVERNANCE" | "OTHER";
type IncidentSortMode = "blocking_first" | "newest_first";

function incidentTypeForIssue(issue: CockpitIssueRow): IncidentFilterType {
  const t = (issue.type ?? issue.issue_type ?? "").toString().toUpperCase();
  const it = (issue.issue_type ?? "").toString().toUpperCase();
  if (it === "ILLEGAL" || t.includes("ILLEGAL")) return "ILLEGAL";
  if (it === "UNSTAFFED" || t.includes("UNSTAFFED")) return "UNSTAFFED";
  if (t.includes("GOVERNANCE") || it === "GOVERNANCE") return "GOVERNANCE";
  return "OTHER";
}

function filterAndSortIncidents(
  list: CockpitIssueRow[],
  filter: IncidentFilterType,
  showResolved: boolean,
  sort: IncidentSortMode
): CockpitIssueRow[] {
  let out = list;
  if (filter !== "ALL") {
    out = out.filter((i) => incidentTypeForIssue(i) === filter);
  }
  if (!showResolved) {
    out = out.filter((i) => !i.decision_logged);
  }
  const getCreated = (i: CockpitIssueRow) => {
    const c = (i as Record<string, unknown>).created_at as string | undefined;
    const d = i.date;
    if (c) return new Date(c).getTime();
    if (d) return new Date(d).getTime();
    return 0;
  };
  if (sort === "blocking_first") {
    out = [...out].sort((a, b) => {
      const blockA = a.severity === "BLOCKING" ? 1 : 0;
      const blockB = b.severity === "BLOCKING" ? 1 : 0;
      if (blockB !== blockA) return blockB - blockA;
      return getCreated(b) - getCreated(a);
    });
  } else {
    out = [...out].sort((a, b) => getCreated(b) - getCreated(a));
  }
  return out;
}

function accentColorForVerdict(
  verdict: "GO" | "WARNING" | "NO-GO" | "—" | "Evaluating…"
): string {
  if (verdict === "GO") return "#065F46";
  if (verdict === "WARNING") return "#92400E";
  if (verdict === "NO-GO") return "#7F1D1D";
  return "var(--hairline)";
}

/**
 * 2030 Command Layer skeleton.
 * Structure: TopBar → StatusCore (8/4) → RiskTriad (3) → ActionLayer (3).
 * StatusCore is wired to /api/cockpit/summary. Mode toggle: GLOBAL | SHIFT.
 */
export default function CockpitPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"GLOBAL" | "SHIFT">("GLOBAL");
  const [shiftCode, setShiftCode] = useState("Day");
  const [selectedDate, setSelectedDate] = useState(() => todayString());

  const [summary, setSummary] = useState<CockpitSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [issues, setIssues] = useState<CockpitIssueRow[]>([]);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [drawerIssue, setDrawerIssue] = useState<CockpitIssueRow | null>(null);
  const [drawerView, setDrawerView] = useState<"details" | "decision">("details");
  const [decisionType, setDecisionType] = useState<string>("Acknowledge");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionSaved, setDecisionSaved] = useState(false);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const [incidentsSort, setIncidentsSort] = useState<IncidentSortMode>("blocking_first");
  const [incidentsFilter, setIncidentsFilter] = useState<IncidentFilterType>("ALL");
  const [showResolved, setShowResolved] = useState(false);

  const [recentDecisions, setRecentDecisions] = useState<Array<{ id: string; created_at: string; action: string; reason: string; issue_type: string; station_code: string | null }>>([]);
  const [recentDecisionsLoading, setRecentDecisionsLoading] = useState(false);
  const [recentDecisionsVersion, setRecentDecisionsVersion] = useState(0);

  const activeIncidentsRef = useRef<HTMLDivElement>(null);
  const drawerDecisionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerIssue) return;
    if (drawerView === "decision") {
      drawerDecisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [drawerIssue, drawerView]);

  useEffect(() => {
    if (!drawerIssue) {
      setDecisionSaved(false);
      setDecisionError(null);
    }
  }, [drawerIssue]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerIssue) {
        setDrawerIssue(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerIssue]);

  useEffect(() => {
    const params = new URLSearchParams({
      date: selectedDate,
      shift_code: shiftCode,
      line: "all",
    });
    if (mode === "SHIFT") {
      params.set("mode", "shift");
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<CockpitSummaryResponse>(`/api/cockpit/summary?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSummary(res.data);
        } else {
          setError(res.error ?? "Failed to load summary");
          setSummary(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Request failed");
        setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedDate, shiftCode]);

  useEffect(() => {
    const params = new URLSearchParams({
      date: selectedDate,
      shift_code: shiftCode,
      line: "all",
    });
    if (mode === "SHIFT") params.set("mode", "shift");
    else params.set("mode", "global");
    let cancelled = false;
    setIssuesLoading(true);
    setIssuesError(null);
    fetchJson<{ ok?: boolean; issues?: CockpitIssueRow[] } | CockpitIssueRow[]>(
      `/api/cockpit/issues?${params.toString()}`
    )
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setIssuesError("No incident feed endpoint available.");
          setIssues([]);
          return;
        }
        const body = res.data;
        if (Array.isArray(body)) {
          setIssues(body);
          setIssuesError(null);
        } else if (body && typeof body === "object" && (body as { ok?: boolean }).ok && Array.isArray((body as { issues?: CockpitIssueRow[] }).issues)) {
          setIssues((body as { issues: CockpitIssueRow[] }).issues);
          setIssuesError(null);
        } else {
          setIssues([]);
          setIssuesError(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setIssuesError("No incident feed endpoint available.");
        setIssues([]);
      })
      .finally(() => {
        if (!cancelled) setIssuesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedDate, shiftCode]);

  useEffect(() => {
    if (mode !== "SHIFT") {
      setRecentDecisions([]);
      return;
    }
    let cancelled = false;
    setRecentDecisionsLoading(true);
    const params = new URLSearchParams({ date: selectedDate, shift_code: shiftCode });
    fetchJson<{ ok?: boolean; decisions?: Array<{ id: string; created_at: string; action: string; reason: string; issue_type: string; station_code: string | null }> }>(
      `/api/cockpit/decisions/recent?${params.toString()}`
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.ok && Array.isArray(res.data.decisions)) {
          setRecentDecisions(res.data.decisions);
        } else {
          setRecentDecisions([]);
        }
      })
      .catch(() => {
        if (!cancelled) setRecentDecisions([]);
      })
      .finally(() => {
        if (!cancelled) setRecentDecisionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, selectedDate, shiftCode, recentDecisionsVersion]);

  const verdict: Verdict | null = summary ? verdictFromSummary(summary) : null;
  const blockingConditions = summary?.active_blocking ?? 0;
  const illegalStates = countByType(summary?.by_type, "ILLEGAL");
  const unstaffedStations = countByType(summary?.by_type, "UNSTAFFED");
  const governanceConflicts = countByType(summary?.by_type, "GOVERNANCE");

  const legalRisk = riskLegal(summary);
  const staffingRisk = riskStaffing(summary);
  const driftRisk = riskDrift(summary);

  function scrollActionToRef(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToActiveIncidents() {
    scrollActionToRef(activeIncidentsRef);
  }

  /** Map UI decision label to API action enum (ACKNOWLEDGE | OVERRIDE | ESCALATE). */
  function decisionActionEnum(): "ACKNOWLEDGE" | "OVERRIDE" | "ESCALATE" {
    if (decisionType === "Acknowledge") return "ACKNOWLEDGE";
    if (decisionType === "Override") return "OVERRIDE";
    return "ESCALATE";
  }

  async function handleSaveDecision() {
    if (mode !== "SHIFT" || !drawerIssue || decisionReason.trim().length < 10 || decisionSaving) return;
    setDecisionSaving(true);
    setDecisionError(null);
    const body = {
      decision_type: decisionActionEnum(),
      reason: decisionReason.trim(),
      date: selectedDate,
      shift_code: shiftCode,
      issue: {
        ...drawerIssue,
        type: drawerIssue.type ?? drawerIssue.issue_type,
        issue_type: drawerIssue.issue_type,
        station_id: drawerIssue.station_id,
        station_code: drawerIssue.station_code,
      },
    };
    try {
      const res = await fetchJson<{ ok?: boolean; decision_id?: string; idempotency_key?: string; target_type?: string; target_id?: string; error?: string }>(
        "/api/cockpit/decisions/incident",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        setDecisionError(res.error ?? "Failed to save decision");
        return;
      }
      if (res.data?.ok) {
        setDecisionSaved(true);
        setRecentDecisionsVersion((v) => v + 1);
        setTimeout(() => setDrawerIssue(null), 400);
      } else {
        setDecisionError(typeof res.data?.error === "string" ? res.data.error : "Failed to save decision");
      }
    } catch {
      setDecisionError("Failed to save decision");
    } finally {
      setDecisionSaving(false);
    }
  }

  return (
    <PageFrame>
      <div className="min-h-[calc(100vh-0px)] h-[calc(100vh-0px)] flex flex-col">
        {/* TopBar: fixed at top, no scroll */}
        <header
          className="h-8 w-full flex items-center justify-between px-0 shrink-0 rounded-sm border-b"
          style={{
            height: "32px",
            borderColor: "var(--hairline, rgba(15,23,42,0.10))",
            background: "var(--surface-2, #F9FAFB)",
          }}
          data-testid="cockpit-topbar"
        >
        <span className="text-xs font-medium" style={{ color: "var(--text-2)" }}>
          Command Layer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("GLOBAL")}
            className="px-2.5 py-1 text-xs font-medium rounded transition-colors"
            style={
              mode === "GLOBAL"
                ? { background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--hairline)" }
                : { color: "var(--text-2)", border: "1px solid transparent" }
            }
            data-testid="cockpit-mode-global"
          >
            GLOBAL
          </button>
          <button
            type="button"
            onClick={() => setMode("SHIFT")}
            className="px-2.5 py-1 text-xs font-medium rounded transition-colors"
            style={
              mode === "SHIFT"
                ? { background: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--hairline)" }
                : { color: "var(--text-2)", border: "1px solid transparent" }
            }
            data-testid="cockpit-mode-shift"
          >
            SHIFT
          </button>
        </div>
      </header>

        {/* Main: non-scroll (AboveFold) + scroll (ActionLayer) */}
        <main className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* AboveFold: StatusCore + RiskTriad, no scroll */}
          <div className="shrink-0">
            {mode === "SHIFT" && (
              <div
                data-testid="cockpit-shift-strip"
                className="shrink-0 h-8 flex items-center justify-between px-3 border border-[var(--hairline)] bg-[var(--surface-2)] mb-3"
                style={{ borderRadius: 4 }}
              >
                <div className="text-[12px] tracking-[0.12em] uppercase text-[var(--text-2)]">
                  SHIFT • {selectedDate} • {shiftCode} • LINE: ALL
                </div>
                <div className="text-[12px] tracking-[0.12em] uppercase text-[var(--text-3)]">
                  Decisions enabled
                </div>
              </div>
            )}
            {/* StatusCore: 8/4 grid split */}
            <section
              className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-4 min-h-[360px] max-h-[480px] overflow-hidden"
              data-testid="cockpit-status-core"
            >
        {/* Left: 8 cols — Industrial Status + counts */}
        <div
          className="lg:col-span-8 rounded-lg border p-6"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          <div
            data-testid="cockpit-status-accent"
            className="w-full rounded-[2px]"
            style={{
              height: 3,
              background: accentColorForVerdict(
                loading ? "Evaluating…" : error ? "—" : (verdict ?? "—") as "GO" | "WARNING" | "NO-GO" | "—" | "Evaluating…"
              ),
            }}
          />
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-1 mt-4" style={{ color: "var(--text-2)" }}>
            Industrial Status
          </h2>
          <p className="text-2xl font-semibold tabular-nums mb-6" style={{ color: "var(--text)" }} data-testid="cockpit-verdict">
            {loading ? "Evaluating…" : error ? "—" : verdict ?? "—"}
          </p>
          {error && (
            <p className="text-sm mb-4" style={{ color: "var(--text-2)" }} data-testid="cockpit-summary-error">
              {error}
            </p>
          )}
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <li className="flex items-center gap-2">
              <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>{blockingConditions}</span>
              <span style={{ color: "var(--text-2)" }}>Blocking Conditions</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>{illegalStates}</span>
              <span style={{ color: "var(--text-2)" }}>Illegal States</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>{unstaffedStations}</span>
              <span style={{ color: "var(--text-2)" }}>Unstaffed Stations</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="tabular-nums font-medium" style={{ color: "var(--text)" }}>{governanceConflicts}</span>
              <span style={{ color: "var(--text-2)" }}>Governance Conflicts</span>
            </li>
          </ul>
        </div>
        {/* Right: 4 cols — Mode + Date + Shift */}
        <div
          className="lg:col-span-4 rounded-lg border p-6"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text)" }}>
            MODE: {mode}
          </p>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Date: {selectedDate}
          </p>
          <p className="text-sm" style={{ color: "var(--text-2)" }}>
            Shift: {mode === "SHIFT" ? shiftCode : "—"}
          </p>
          {mode === "SHIFT" && (
            <select
              value={shiftCode}
              onChange={(e) => setShiftCode(e.target.value)}
              className="mt-3 text-sm rounded border px-2 py-1.5 w-full max-w-[140px]"
              style={{
                borderColor: "var(--hairline)",
                background: "var(--surface-3)",
                color: "var(--text)",
              }}
              data-testid="cockpit-shift-select"
            >
              {SHIFT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          )}
          <p className="text-sm mt-2" style={{ color: "var(--text-2)" }}>
            Last evaluation: —
          </p>
        </div>
      </section>

            {/* RiskTriad: 3 live blocks, tight height */}
            <section
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 max-h-[160px] overflow-hidden"
              data-testid="cockpit-risk-triad"
            >
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
          data-testid="cockpit-risk-legal"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            LEGAL EXPOSURE
          </h3>
          <p className="text-xs mt-1 font-medium" style={{ color: "var(--text)" }}>
            {legalRisk.level}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Active: {legalRisk.count}
          </p>
          <button
            type="button"
            onClick={scrollToActiveIncidents}
            className="text-xs mt-2 font-medium underline focus:outline-none"
            style={{ color: "var(--text-2)" }}
          >
            View incidents
          </button>
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
          data-testid="cockpit-risk-staffing"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            STAFFING RISK
          </h3>
          <p className="text-xs mt-1 font-medium" style={{ color: "var(--text)" }}>
            {staffingRisk.level}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Active: {staffingRisk.count}
          </p>
          <button
            type="button"
            onClick={scrollToActiveIncidents}
            className="text-xs mt-2 font-medium underline focus:outline-none"
            style={{ color: "var(--text-2)" }}
          >
            View incidents
          </button>
        </div>
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
          data-testid="cockpit-risk-drift"
        >
          <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            OPERATIONAL DRIFT
          </h3>
          <p className="text-xs mt-1 font-medium" style={{ color: "var(--text)" }}>
            {driftRisk.level}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-3)" }}>
            Active: {driftRisk.count}
          </p>
          <button
            type="button"
            onClick={scrollToActiveIncidents}
            className="text-xs mt-2 font-medium underline focus:outline-none"
            style={{ color: "var(--text-2)" }}
          >
            View incidents
          </button>
        </div>
      </section>
          </div>

          {/* Divider: EXECUTION */}
          <div
            className="shrink-0 flex items-center gap-2 py-1.5 border-b"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              EXECUTION
            </span>
          </div>

          {/* ActionLayer: only scrollable region */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <section
              className="grid grid-cols-1 md:grid-cols-3 gap-6 p-1"
              data-testid="cockpit-action-layer"
            >
        <div
          ref={activeIncidentsRef}
          className="rounded-lg border p-4 min-h-[120px]"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
          data-testid="cockpit-active-incidents"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
              ACTIVE INCIDENTS
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={incidentsSort}
                onChange={(e) => setIncidentsSort(e.target.value as IncidentSortMode)}
                className="text-xs rounded border px-2 py-1"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--surface-3)",
                  color: "var(--text)",
                }}
                data-testid="cockpit-incidents-sort"
              >
                <option value="blocking_first">Blocking first</option>
                <option value="newest_first">Newest first</option>
              </select>
              {(["ALL", "ILLEGAL", "UNSTAFFED", "GOVERNANCE", "OTHER"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setIncidentsFilter(f)}
                  className="text-xs font-medium px-2 py-1 rounded border"
                  style={{
                    borderColor: incidentsFilter === f ? "var(--text-2)" : "var(--hairline)",
                    background: incidentsFilter === f ? "var(--surface-3)" : "transparent",
                    color: "var(--text-2)",
                  }}
                  data-testid={`cockpit-incidents-filter-${f.toLowerCase()}`}
                >
                  {f}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-2)" }}>
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  className="rounded border"
                  style={{ borderColor: "var(--hairline)" }}
                  data-testid="cockpit-incidents-show-resolved"
                />
                Show resolved
              </label>
            </div>
          </div>
          {issuesError && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              {issuesError}
            </p>
          )}
          {!issuesError && issuesLoading && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              Loading…
            </p>
          )}
          {!issuesError && !issuesLoading && issues.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>
              —
            </p>
          )}
          {!issuesError && !issuesLoading && issues.length > 0 && (() => {
            const filteredIssues = filterAndSortIncidents(issues, incidentsFilter, showResolved, incidentsSort);
            return filteredIssues.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-3)" }}>—</p>
            ) : (
            <ul className="space-y-2">
              {filteredIssues.map((issue) => {
                const cardLines = incidentCardLines(issue);
                return (
                <li
                  key={issue.issue_id}
                  className="rounded border-l-2 pl-3 py-2 border"
                  style={{
                    borderColor: "var(--hairline)",
                    borderLeftColor: issue.decision_overrides_blocking
                      ? "var(--hairline)"
                      : issue.severity === "BLOCKING"
                        ? "var(--status-critical, #B91C1C)"
                        : "var(--status-warning, #B45309)",
                    background: "var(--surface-3)",
                  }}
                  data-testid="cockpit-incident-card"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold" style={{ color: "var(--text)" }}>
                        {cardLines.line1}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-3)" }} title={cardLines.line2}>
                        {cardLines.line2 || "—"}
                      </p>
                    </div>
                    {mode === "SHIFT" && issue.decision_logged && (
                      <span
                        className="text-xs font-medium uppercase tracking-wider shrink-0"
                        style={{ color: "var(--text-3)" }}
                        data-testid="cockpit-incident-decision-badge"
                      >
                        {issue.decision_overrides_blocking ? "OVERRIDDEN" : `DECISION LOGGED — ${issue.decision_action ?? "—"}`}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerIssue(issue);
                        setDrawerView("details");
                      }}
                      className="text-xs font-medium underline focus:outline-none"
                      style={{ color: "var(--text-2)" }}
                      data-testid="cockpit-incident-details"
                    >
                      Details
                    </button>
                    {mode === "SHIFT" && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerIssue(issue);
                          setDrawerView("decision");
                        }}
                        className="text-xs font-medium underline focus:outline-none"
                        style={{ color: "var(--text-2)" }}
                        data-testid={issue.decision_logged ? "cockpit-incident-view-decision" : "cockpit-incident-log-decision"}
                      >
                        {issue.decision_logged ? "View decision" : "Log decision"}
                      </button>
                    )}
                    {mode === "SHIFT" && issue.decision_logged && issue.decision_id && (
                      <button
                        type="button"
                        onClick={() => router.push(`/app/admin/audit?id=${encodeURIComponent(issue.decision_id!)}`)}
                        className="text-xs font-medium underline focus:outline-none"
                        style={{ color: "var(--text-3)" }}
                        data-testid="cockpit-incident-open-audit"
                      >
                        Open audit
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          );
          }
        )()}
        </div>
        <div
          className="rounded-lg border p-4 min-h-[120px]"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
          data-testid="cockpit-execution-decisions-ledger"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-2)" }}>
            EXECUTION DECISIONS
          </h3>
          {mode !== "SHIFT" && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>—</p>
          )}
          {mode === "SHIFT" && recentDecisionsLoading && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>Loading…</p>
          )}
          {mode === "SHIFT" && !recentDecisionsLoading && recentDecisions.length === 0 && (
            <p className="text-xs" style={{ color: "var(--text-3)" }}>—</p>
          )}
          {mode === "SHIFT" && !recentDecisionsLoading && recentDecisions.length > 0 && (
            <ul className="space-y-2">
              {recentDecisions.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs border-b"
                  style={{ borderColor: "var(--hairline)", paddingBottom: 6 }}
                >
                  <span className="font-mono shrink-0" style={{ color: "var(--text-3)" }}>
                    {d.created_at ? new Date(d.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}
                  </span>
                  <span className="font-medium uppercase" style={{ color: "var(--text-2)" }}>{d.action}</span>
                  <span className="truncate min-w-0 flex-1" style={{ color: "var(--text-2)" }} title={d.reason}>
                    {d.reason ? (d.reason.length > 48 ? `${d.reason.slice(0, 48)}…` : d.reason) : "—"}
                  </span>
                  <button
                    type="button"
                    onClick={() => router.push(`/app/admin/audit?id=${encodeURIComponent(d.id)}`)}
                    className="text-xs font-medium underline shrink-0 focus:outline-none"
                    style={{ color: "var(--text-3)" }}
                    data-testid="cockpit-decision-ledger-open-audit"
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div
          className="rounded-lg border p-6 min-h-[120px]"
          style={{
            borderColor: "var(--hairline)",
            background: "var(--surface-2)",
          }}
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
            COMPLIANCE ACTIONS
          </h3>
          <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
            —
          </p>
        </div>
            </section>
          </div>
        </main>
      </div>

      {/* Incident details drawer: overlay + right panel */}
      {drawerIssue && (
        <div
          className="fixed inset-0 z-50"
          data-testid="cockpit-incident-drawer"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Close"
            onClick={() => setDrawerIssue(null)}
          />
          <div
            className="absolute right-0 top-0 z-10 h-full w-[520px] max-w-[92vw] overflow-y-auto border-l shadow-xl p-4"
            style={{
              background: "var(--surface-2)",
              borderColor: "var(--hairline)",
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                INCIDENT
              </span>
              <button
                type="button"
                onClick={() => setDrawerIssue(null)}
                className="text-xs font-medium px-2 py-1 rounded border"
                style={{
                  borderColor: "var(--hairline)",
                  background: "var(--surface-3)",
                  color: "var(--text)",
                }}
              >
                Close
              </button>
            </div>
            <pre className="text-xs whitespace-pre-wrap font-mono mb-4" style={{ color: "var(--text-2)" }}>
              {JSON.stringify(
                {
                  type: drawerIssue.type || drawerIssue.issue_type,
                  station_code: drawerIssue.station_code ?? undefined,
                  station_name: drawerIssue.station_name ?? undefined,
                  employee_name: (drawerIssue as Record<string, unknown>).employee_name ?? undefined,
                  reason_codes: (drawerIssue as Record<string, unknown>).reason_codes ?? undefined,
                  created_at: (drawerIssue as Record<string, unknown>).created_at ?? drawerIssue.date ?? undefined,
                },
                null,
                2
              )}
            </pre>
            {mode === "SHIFT" && (
              <>
                <div className="border-t my-4" style={{ borderColor: "var(--hairline)" }} />
                <div ref={drawerDecisionRef} className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                    DECISION
                  </span>
                  {drawerIssue.decision_logged ? (
                    <div className="space-y-2" data-testid="cockpit-decision-readonly">
                      <div>
                        <span className="text-xs font-medium" style={{ color: "var(--text-3)" }}>Action</span>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>
                          {drawerIssue.decision_action ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: "var(--text-3)" }}>Reason</span>
                        <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: "var(--text)" }}>
                          {drawerIssue.decision_reason ?? "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium" style={{ color: "var(--text-3)" }}>Logged at</span>
                        <p className="text-xs mt-0.5" style={{ color: "var(--text)" }}>
                          {drawerIssue.decision_created_at
                            ? new Date(drawerIssue.decision_created_at).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                      {drawerIssue.decision_action === "OVERRIDE" && (
                        <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
                          Blocking impact removed for verdict.
                        </p>
                      )}
                      {drawerIssue.decision_id && (
                        <button
                          type="button"
                          onClick={() => router.push(`/app/admin/audit?id=${encodeURIComponent(drawerIssue.decision_id!)}`)}
                          className="text-xs font-medium underline focus:outline-none mt-2"
                          style={{ color: "var(--text-3)" }}
                          data-testid="cockpit-decision-open-audit"
                        >
                          Open audit
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                          Type
                        </label>
                        <select
                          value={decisionType}
                          onChange={(e) => setDecisionType(e.target.value)}
                          className="w-full text-xs rounded border px-2 py-1.5"
                          style={{
                            borderColor: "var(--hairline)",
                            background: "var(--surface-3)",
                            color: "var(--text)",
                          }}
                          data-testid="cockpit-decision-type"
                        >
                          <option value="Acknowledge">Acknowledge</option>
                          <option value="Override">Override</option>
                          <option value="Escalate">Escalate</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-2)" }}>
                          Reason
                        </label>
                        <textarea
                          value={decisionReason}
                          onChange={(e) => setDecisionReason(e.target.value)}
                          rows={3}
                          placeholder="Reason"
                          className="w-full text-xs rounded border px-2 py-1.5 resize-y"
                          style={{
                            borderColor: "var(--hairline)",
                            background: "var(--surface-3)",
                            color: "var(--text)",
                          }}
                          data-testid="cockpit-decision-reason"
                        />
                      </div>
                      <div>
                        <button
                          type="button"
                          disabled={
                            decisionSaving ||
                            !drawerIssue ||
                            decisionReason.trim().length < 10
                          }
                          onClick={handleSaveDecision}
                          className="text-xs font-medium px-3 py-1.5 rounded border"
                          style={{
                            borderColor: "var(--hairline)",
                            background: "var(--surface-3)",
                            color:
                              decisionSaving || decisionReason.trim().length < 10
                                ? "var(--text-3)"
                                : "var(--text)",
                            cursor:
                              decisionSaving || decisionReason.trim().length < 10
                                ? "not-allowed"
                                : "pointer",
                          }}
                          data-testid="cockpit-decision-save"
                        >
                          {decisionSaving ? "Saving…" : "Save decision"}
                        </button>
                        {decisionSaved && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--text-2)" }}
                            data-testid="cockpit-decision-saved"
                          >
                            Decision logged.
                          </p>
                        )}
                        {decisionError && (
                          <p
                            className="text-xs mt-1"
                            style={{ color: "var(--status-critical, #B91C1C)" }}
                          >
                            {decisionError}
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
