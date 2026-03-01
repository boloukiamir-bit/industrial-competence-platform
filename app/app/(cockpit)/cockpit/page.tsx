"use client";

import { useState, useEffect, useRef } from "react";
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

  const activeIncidentsRef = useRef<HTMLDivElement>(null);

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
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-2)" }}>
            ACTIVE INCIDENTS
          </h3>
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
          {!issuesError && !issuesLoading && issues.length > 0 && (
            <ul className="space-y-2">
              {issues.map((issue) => (
                <li
                  key={issue.issue_id}
                  className="rounded border-l-2 pl-3 py-2 border"
                  style={{
                    borderColor: "var(--hairline)",
                    borderLeftColor:
                      issue.severity === "BLOCKING"
                        ? "var(--status-critical, #B91C1C)"
                        : "var(--status-warning, #B45309)",
                    background: "var(--surface-3)",
                  }}
                  data-testid="cockpit-incident-card"
                >
                  <p className="text-xs font-medium" style={{ color: "var(--text)" }}>
                    {issue.type || issue.issue_type}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-2)" }}>
                    {issueSummary(issue)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDrawerIssue(issue)}
                    className="text-xs mt-1.5 font-medium underline focus:outline-none"
                    style={{ color: "var(--text-2)" }}
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
            EXECUTION DECISIONS
          </h3>
          <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
            —
          </p>
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

      {/* Minimal incident details drawer */}
      {drawerIssue && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(15,23,42,0.4)" }}
          data-testid="cockpit-incident-drawer"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="rounded-lg border p-4 max-w-md w-full max-h-[80vh] overflow-auto"
            style={{
              borderColor: "var(--hairline)",
              background: "var(--surface-2)",
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                Incident details
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
            <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: "var(--text-2)" }}>
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
          </div>
        </div>
      )}
    </PageFrame>
  );
}
