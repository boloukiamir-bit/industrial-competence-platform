"use client";

import { useState, useEffect } from "react";
import { PageFrame } from "@/components/layout/PageFrame";
import { fetchJson } from "@/lib/coreFetch";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";

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

  const verdict: Verdict | null = summary ? verdictFromSummary(summary) : null;
  const blockingConditions = summary?.active_blocking ?? 0;
  const illegalStates = countByType(summary?.by_type, "ILLEGAL");
  const unstaffedStations = countByType(summary?.by_type, "UNSTAFFED");
  const governanceConflicts = countByType(summary?.by_type, "GOVERNANCE");

  return (
    <PageFrame>
      {/* TopBar: thin 32px bar + mode toggle */}
      <header
        className="h-8 w-full flex items-center justify-between px-0 mb-6 rounded-sm border-b"
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

      {/* StatusCore: 8/4 grid split */}
      <section
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8"
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
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-2)" }}>
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

      {/* RiskTriad: 3 horizontal blocks */}
      <section
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
        data-testid="cockpit-risk-triad"
      >
        {(["LEGAL EXPOSURE", "STAFFING RISK", "OPERATIONAL DRIFT"] as const).map((label) => (
          <div
            key={label}
            className="rounded-lg border p-6"
            style={{
              borderColor: "var(--hairline)",
              background: "var(--surface-2)",
            }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
              {label}
            </h3>
            <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
              Placeholder
            </p>
          </div>
        ))}
      </section>

      {/* ActionLayer: 3 placeholder sections */}
      <section
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
        data-testid="cockpit-action-layer"
      >
        {(["ACTIVE INCIDENTS", "EXECUTION DECISIONS", "COMPLIANCE ACTIONS"] as const).map((label) => (
          <div
            key={label}
            className="rounded-lg border p-6 min-h-[120px]"
            style={{
              borderColor: "var(--hairline)",
              background: "var(--surface-2)",
            }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-2)" }}>
              {label}
            </h3>
            <p className="text-xs mt-2" style={{ color: "var(--text-3)" }}>
              —
            </p>
          </div>
        ))}
      </section>
    </PageFrame>
  );
}
