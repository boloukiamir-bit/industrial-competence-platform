"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  if (t.includes("SKILL") || it === "SKILL") return "OTHER";
  return "OTHER";
}

/** Deterministic human-readable "what happened" from payload (no AI). */
function incidentWhatHappened(issue: CockpitIssueRow): string {
  const typeLabel = (issue.type ?? issue.issue_type ?? "INCIDENT").toString().trim();
  const stationCode = (issue.station_code ?? "").toString().trim();
  const stationName = (issue.station_name ?? "").toString().trim();
  const station = stationCode ? (stationName ? `${stationCode} (${stationName})` : stationCode) : "—";
  const severity = issue.severity === "BLOCKING" ? "blocking" : "non-blocking";
  const employee = (issue as Record<string, unknown>).employee_name as string | undefined;
  const reasonCodes = (issue as Record<string, unknown>).reason_codes as string[] | undefined;
  const reason = (issue as Record<string, unknown>).reason as string | undefined;
  const message = (issue as Record<string, unknown>).message as string | undefined;
  const title = (issue as Record<string, unknown>).title as string | undefined;
  const parts: string[] = [];
  parts.push(`${typeLabel} at ${station} (${severity}).`);
  if (employee) parts.push(`Employee: ${employee}.`);
  const why = reasonCodes?.[0] ?? reason ?? message ?? title ?? "";
  if (why) parts.push(why);
  return parts.join(" ");
}

function criticalPathPriority(issue: CockpitIssueRow): number {
  const type = incidentTypeForIssue(issue);
  if (type === "ILLEGAL") return 1;
  if (type === "UNSTAFFED") return 2;
  if (type === "GOVERNANCE") return 3;
  const t = (issue.type ?? issue.issue_type ?? "").toString().toUpperCase();
  if (t.includes("SKILL") || issue.type === "SKILL") return 4;
  return 5;
}

function criticalPathSuggestedAction(issue: CockpitIssueRow): string {
  const type = incidentTypeForIssue(issue);
  if (type === "ILLEGAL") return "ESCALATE / FIX COMPLIANCE";
  if (type === "UNSTAFFED") return "ASSIGN";
  if (type === "GOVERNANCE") return "ESCALATE";
  const t = (issue.type ?? issue.issue_type ?? "").toString().toUpperCase();
  if (t.includes("SKILL") || issue.type === "SKILL") return "ASSIGN / SWAP";
  return "ACK / OVERRIDE";
}

/** Display label for incident type in Command UI (ILLEGAL / UNSTAFFED / GOVERNANCE / SKILL / other raw). */
function incidentTypeDisplayLabel(issue: CockpitIssueRow): string {
  const t = (issue.type ?? issue.issue_type ?? "").toString().toUpperCase();
  if (t.includes("SKILL")) return "SKILL";
  const filterType = incidentTypeForIssue(issue);
  return filterType === "OTHER" ? (issue.type ?? issue.issue_type ?? "INCIDENT").toString() : filterType;
}

/** Subline for critical path card: station + time. */
function criticalPathSubline(issue: CockpitIssueRow): string {
  const stationCode = (issue.station_code ?? "").toString().trim();
  const stationName = (issue.station_name ?? "").toString().trim();
  const station = stationCode ? (stationName ? `${stationCode} (${stationName})` : stationCode) : "—";
  const created = (issue as Record<string, unknown>).created_at as string | undefined;
  const dateStr = issue.date;
  const timeStr = created
    ? new Date(created).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
    : dateStr
      ? new Date(dateStr).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
      : "";
  return timeStr ? `${station} · ${timeStr}` : station;
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

type SystemConfidence = "HIGH" | "MEDIUM" | "LOW";

/** Derive system confidence from summary only; no new API. */
function systemConfidenceFromSummary(summary: CockpitSummaryResponse | null, hasError: boolean): SystemConfidence {
  if (hasError || summary == null) return "LOW";
  const total = summary.active_total;
  const blocking = summary.active_blocking ?? 0;
  const nonblocking = summary.active_nonblocking ?? 0;
  const totalNum = typeof total === "number" && !Number.isNaN(total);
  const blockNum = typeof blocking === "number" && !Number.isNaN(blocking);
  const nonblockNum = typeof nonblocking === "number" && !Number.isNaN(nonblocking);
  if (!totalNum || !blockNum || !nonblockNum) return "LOW";
  if (total === blocking + nonblocking) return "HIGH";
  return "MEDIUM";
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

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
  const [refetchKey, setRefetchKey] = useState(0);

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
          setLastUpdatedAt(new Date());
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
  }, [mode, selectedDate, shiftCode, refetchKey]);

  function triggerRefetch() {
    setRefetchKey((k) => k + 1);
  }

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
  }, [mode, selectedDate, shiftCode, refetchKey]);

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
  const systemConfidence = systemConfidenceFromSummary(summary, !!error);
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
        {/* Main: scrollable; Command Strip sticks at top */}
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          {/* Command Strip: sticky, compact */}
          <div
            className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 py-2 px-4 bg-white border-b border-slate-200"
            data-testid="cockpit-command-strip"
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Command
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMode("GLOBAL")}
                  className="px-2.5 py-1 text-xs font-medium rounded transition-colors border"
                  style={
                    mode === "GLOBAL"
                      ? { background: "var(--surface-3)", color: "var(--text)", borderColor: "var(--hairline)" }
                      : { color: "var(--text-2)", borderColor: "transparent" }
                  }
                  data-testid="cockpit-mode-global"
                >
                  GLOBAL
                </button>
                <button
                  type="button"
                  onClick={() => setMode("SHIFT")}
                  className="px-2.5 py-1 text-xs font-medium rounded transition-colors border"
                  style={
                    mode === "SHIFT"
                      ? { background: "var(--surface-3)", color: "var(--text)", borderColor: "var(--hairline)" }
                      : { color: "var(--text-2)", borderColor: "transparent" }
                  }
                  data-testid="cockpit-mode-shift"
                >
                  SHIFT
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {mode === "SHIFT" ? (
                <>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Date</span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 bg-white"
                      data-testid="cockpit-date-input"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="font-medium">Shift</span>
                    <select
                      value={shiftCode}
                      onChange={(e) => setShiftCode(e.target.value)}
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-900 bg-white"
                      data-testid="cockpit-shift-select"
                    >
                      {SHIFT_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <span className="text-xs text-slate-500">Global view</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500" data-testid="cockpit-last-updated">
              <span>Last updated</span>
              <span className="font-mono tabular-nums">
                {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"}
              </span>
            </div>
          </div>

          {/* AboveFold: StatusCore + RiskTriad */}
          <div className="shrink-0">
            {mode === "SHIFT" && (
              <div
                data-testid="cockpit-shift-strip"
                className="shrink-0 h-8 flex items-center justify-between px-3 border border-[var(--hairline)] bg-[var(--surface-2)] mb-3 mx-4 mt-4"
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
        {/* Left: 8 cols — Industrial Status (instrument panel) */}
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
          <div className="flex items-start justify-between gap-4 mt-4 mb-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
              Industrial Status
            </h2>
            <div className="flex items-center gap-2 shrink-0" data-testid="cockpit-system-confidence">
              <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                System confidence
              </span>
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  systemConfidence === "HIGH"
                    ? "bg-emerald-100 text-emerald-800"
                    : systemConfidence === "MEDIUM"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-200 text-slate-600"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    systemConfidence === "HIGH"
                      ? "bg-emerald-600"
                      : systemConfidence === "MEDIUM"
                        ? "bg-amber-600"
                        : "bg-slate-500"
                  }`}
                  aria-hidden
                />
                {systemConfidence}
              </span>
            </div>
          </div>
          <p
            className="text-3xl font-bold tracking-tight tabular-nums text-slate-900 mt-1 mb-5"
            data-testid="cockpit-verdict"
          >
            {loading ? "—" : error ? "—" : !summary ? "—" : verdict ?? "—"}
          </p>
          {loading && (
            <div className="flex items-center gap-2 mb-4" data-testid="cockpit-status-loading">
              <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" aria-hidden />
              <span className="text-sm text-slate-600">Computing readiness…</span>
            </div>
          )}
          {error && (
            <div className="mb-4" data-testid="cockpit-summary-error">
              <p className="text-sm font-medium text-slate-900">System status unavailable</p>
              <p className="text-xs text-slate-500 mt-0.5">Unable to load readiness for selected parameters.</p>
              <button
                type="button"
                onClick={triggerRefetch}
                className="mt-2 text-xs font-medium px-2 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                data-testid="cockpit-summary-retry"
              >
                Retry
              </button>
            </div>
          )}
          {!loading && !error && !summary && (
            <div className="mb-4" data-testid="cockpit-summary-empty">
              <p className="text-sm font-medium text-slate-900">No data for selected shift</p>
              <p className="text-xs text-slate-500 mt-0.5">Check date/shift.</p>
            </div>
          )}
          {!loading && summary && (
          <div className="flex flex-wrap gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Blocking</p>
              <p className="text-xl font-bold tabular-nums text-slate-900 mt-0.5">{blockingConditions}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Non-blocking</p>
              <p className="text-lg font-semibold tabular-nums text-slate-600 mt-0.5">
                {summary.active_nonblocking ?? 0}
              </p>
            </div>
          </div>
          )}
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
            className="shrink-0 flex items-center gap-2 py-1.5 border-b px-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--text-3)" }}>
              EXECUTION
            </span>
          </div>

          {/* ActionLayer */}
          <div className="min-h-0">
            <section
              className="grid grid-cols-1 md:grid-cols-3 gap-6 p-1"
              data-testid="cockpit-action-layer"
            >
        {/* Critical Path: SHIFT only, above Incident Feed; 1–3 command-style cards */}
        {mode === "SHIFT" && (() => {
          const getCreated = (i: CockpitIssueRow) => {
            const c = (i as Record<string, unknown>).created_at as string | undefined;
            const d = i.date;
            if (c) return new Date(c).getTime();
            if (d) return new Date(d).getTime();
            return 0;
          };
          const criticalPathIssues = issues
            .filter((i) => i.severity === "BLOCKING" && !i.decision_overrides_blocking)
            .sort((a, b) => {
              const pa = criticalPathPriority(a);
              const pb = criticalPathPriority(b);
              if (pa !== pb) return pa - pb;
              return getCreated(b) - getCreated(a);
            })
            .slice(0, 3);
          return (
            <div className="col-span-full space-y-3 mb-2" data-testid="cockpit-critical-path">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-700">
                  CRITICAL PATH
                </h3>
                {criticalPathIssues.length > 0 && (
                  <span className="text-xs font-medium text-slate-500">
                    {criticalPathIssues.length} blocking
                  </span>
                )}
              </div>
              {criticalPathIssues.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white py-4 px-4" data-testid="cockpit-critical-path-clear"><p className="text-sm font-semibold text-slate-800">Critical path clear</p><p className="text-xs text-slate-500 mt-0.5">No blocking items require action.</p></div>
              )}
              {criticalPathIssues.length > 0 &&
                criticalPathIssues.map((issue) => (
                  <div
                    key={issue.issue_id}
                    className="flex rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                    data-testid="cockpit-critical-path-item"
                  >
                    <div
                      className="w-1 shrink-0 bg-[#7F1D1D]"
                      aria-hidden
                    />
                    <div className="flex-1 min-w-0 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                            {incidentTypeDisplayLabel(issue)}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7F1D1D]/10 text-[#7F1D1D]">
                            BLOCKING
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 leading-snug">
                          {incidentWhatHappened(issue)}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {criticalPathSubline(issue)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerIssue(issue);
                            setDrawerView("decision");
                          }}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                          data-testid="cockpit-critical-path-log-decision"
                        >
                          Log decision
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerIssue(issue);
                            setDrawerView("details");
                          }}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline focus:outline-none"
                          data-testid="cockpit-critical-path-open"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          );
        })()}
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
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
                ACTIVE INCIDENTS
              </h3>
              {mode !== "SHIFT" && (
                <p className="text-[11px] text-slate-500 mt-0.5" data-testid="cockpit-shift-hint">
                  Switch to SHIFT to log decisions.
                </p>
              )}
            </div>
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
            <div data-testid="cockpit-incidents-error">
              <p className="text-sm font-medium text-slate-900">Incident feed unavailable</p>
              <button
                type="button"
                onClick={triggerRefetch}
                className="mt-1 text-xs font-medium px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                data-testid="cockpit-incidents-retry"
              >
                Retry
              </button>
            </div>
          )}
          {!issuesError && issuesLoading && (
            <p className="text-xs text-slate-500">Loading incidents…</p>
          )}
          {!issuesError && !issuesLoading && issues.length === 0 && (
            <p className="text-xs text-slate-500" data-testid="cockpit-incidents-empty">
              {mode === "GLOBAL" ? "No active incidents" : "No incidents for selected shift"}
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
                      data-testid="cockpit-incident-open"
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (mode !== "SHIFT") return;
                        setDrawerIssue(issue);
                        setDrawerView("decision");
                      }}
                      disabled={mode !== "SHIFT"}
                      title={mode !== "SHIFT" ? "Switch to SHIFT to log decisions." : undefined}
                      className="text-xs font-medium underline focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ color: "var(--text-2)" }}
                      data-testid={issue.decision_logged ? "cockpit-incident-view-decision" : "cockpit-incident-log-decision"}
                    >
                      {issue.decision_logged ? "View decision" : "Log decision"}
                    </button>
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

      {/* Incident details: centered modal dialog — portaled to body so it is not clipped by app layout overflow */}
      {drawerIssue &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setDrawerIssue(null)}
              aria-hidden
            />
            <div className="relative z-10 w-full max-w-[720px] max-h-[80vh] flex flex-col">
              <div
                data-testid="cockpit-incident-drawer"
                className="bg-white text-slate-900 border border-slate-200 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[80vh]"
              >
                <div className="h-14 px-5 flex items-center justify-between border-b border-slate-200 bg-white shrink-0">
                  <div className="text-[12px] tracking-[0.12em] uppercase text-slate-600">INCIDENT</div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1.5 border border-slate-200 bg-slate-100 text-slate-800 rounded hover:bg-slate-200"
                    onClick={() => setDrawerIssue(null)}
                  >
                    Close
                  </button>
                </div>

                <div className="p-5 overflow-y-auto max-h-[calc(80vh-56px)]">
                {/* Title: incident type */}
                <div className="mb-4">
                  <span
                    className="text-sm font-semibold uppercase tracking-wider text-slate-900"
                    data-testid="cockpit-incident-type-label"
                  >
                    {(() => {
                      const t = (drawerIssue.type ?? drawerIssue.issue_type ?? "").toString().toUpperCase();
                      if (t.includes("SKILL")) return "SKILL";
                      const filterType = incidentTypeForIssue(drawerIssue);
                      return filterType === "OTHER" ? (drawerIssue.type ?? drawerIssue.issue_type ?? "INCIDENT").toString() : filterType;
                    })()}
                  </span>
                </div>
                {/* Key facts grid (2 columns) */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-4 text-xs">
                  <div>
                    <span className="font-medium text-slate-600">Station</span>
                    <p className="mt-0.5 text-slate-900">
                      {drawerIssue.station_code
                        ? (drawerIssue.station_name ? `${drawerIssue.station_code} (${drawerIssue.station_name})` : drawerIssue.station_code)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-600">Severity</span>
                    <p className="mt-0.5 text-slate-900">
                      {drawerIssue.severity === "BLOCKING" ? "BLOCKING" : "NON_BLOCKING"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-slate-600">Created at</span>
                    <p className="mt-0.5 text-slate-900">
                      {(drawerIssue as Record<string, unknown>).created_at
                        ? new Date((drawerIssue as Record<string, unknown>).created_at as string).toLocaleString()
                        : drawerIssue.date
                          ? new Date(drawerIssue.date).toLocaleString()
                          : "—"}
                    </p>
                  </div>
                </div>
                {/* What happened */}
                <div className="mb-4 pb-4 border-b border-slate-200">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-600">
                    What happened
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-slate-900" data-testid="cockpit-incident-what-happened">
                    {incidentWhatHappened(drawerIssue)}
                  </p>
                </div>
            {mode === "SHIFT" && (
              <>
                <div className="border-t border-slate-200 my-4" />
                <div id="decision-area" ref={drawerDecisionRef} className="space-y-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
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
                          {decisionSaving ? "Saving…" : "Log decision"}
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
            </div>
          </div>,
          document.body
        )}
    </PageFrame>
  );
}

