"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Minimal shape for a risk row from Tomorrow's Gaps (line-level). Matches GapsLineRow on cockpit page. */
export type TopOperationalRiskRow = {
  lineCode: string;
  lineName: string;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  root_cause?: { primary: string; causes: string[] };
  missing_skill_codes: string[];
  stations?: Array<{ stationName?: string; stationCode?: string }>;
};

function formatSecondaryReason(row: TopOperationalRiskRow): string {
  const primary = (row.root_cause?.primary ?? "").toUpperCase();
  if (primary === "CAPACITY" || row.eligibleOperatorsCount === 0) {
    const n = row.eligibleOperatorsCount;
    return n === 0 ? "Missing eligible operators" : `Missing ${n} eligible operator${n !== 1 ? "s" : ""}`;
  }
  if (primary === "SKILLS" || (row.missing_skill_codes?.length ?? 0) > 0) return "Skills gap";
  if (primary === "COVERAGE") return "Coverage gap";
  if (row.gapHours > 0) return "Operational gap";
  return "Operational gap";
}

function primaryLabel(row: TopOperationalRiskRow): string {
  if (row.lineName?.trim()) return row.lineName.trim();
  if (row.lineCode?.trim()) return row.lineCode.trim();
  const first = row.stations?.[0];
  if (first?.stationName?.trim()) return first.stationName.trim();
  if (first?.stationCode?.trim()) return first.stationCode.trim();
  return "—";
}

export type TopOperationalRisksBlockProps = {
  risks: TopOperationalRiskRow[];
  loading: boolean;
  error: string | null;
  date: string;
  shiftCode: string;
};

function tomorrowsGapsHref(date: string, shiftCode: string): string {
  const p = new URLSearchParams();
  p.set("date", date);
  p.set("shift", (shiftCode || "").trim().toLowerCase() || "day");
  return `/app/tomorrows-gaps?${p.toString()}`;
}

export function TopOperationalRisksBlock({
  risks,
  loading,
  error,
  date,
  shiftCode,
}: TopOperationalRisksBlockProps) {
  const displayRisks = risks.slice(0, 3);
  const ctaHref = tomorrowsGapsHref(date, shiftCode);

  return (
    <div className="gov-panel overflow-hidden mt-10" data-testid="top-operational-risks-block">
      <div
        className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ borderBottom: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))" }}
      >
        <h2 className="gov-kicker">Top Operational Risks (Next Shift)</h2>
        <Button variant="outline" size="sm" className="h-8 text-[13px]" asChild>
          <Link href={ctaHref} data-testid="top-risks-cta">
            Open Tomorrow&apos;s Gaps
          </Link>
        </Button>
      </div>
      <div className="px-5 py-4">
        {error && (
          <p className="text-sm cockpit-status-at-risk mb-3" data-testid="top-risks-error">
            Could not load tomorrow&apos;s gaps.
          </p>
        )}
        {loading && (
          <p className="text-sm" style={{ color: "var(--text-2)" }} data-testid="top-risks-loading">
            Loading…
          </p>
        )}
        {!loading && displayRisks.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-2)" }} data-testid="top-risks-empty">
            No critical operational risks detected.
          </p>
        )}
        {!loading && displayRisks.length > 0 && (
          <ul className="space-y-2">
            {displayRisks.map((row, idx) => (
              <li
                key={`${row.lineCode}-${idx}`}
                className="flex flex-wrap items-center gap-2 rounded-sm p-3"
                style={{ border: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))" }}
                data-testid={`top-risk-row-${idx}`}
              >
                <span
                  className={cn(
                    "text-xs font-semibold uppercase px-1.5 py-0.5 rounded",
                    row.competenceStatus === "NO-GO" && "cockpit-status-blocking",
                    row.competenceStatus === "WARNING" && "cockpit-status-at-risk"
                  )}
                >
                  {row.competenceStatus === "NO-GO" ? "NO-GO" : "WARNING"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate" style={{ color: "var(--text)" }}>
                    {primaryLabel(row)}
                  </p>
                  <p className="text-xs truncate" style={{ color: "var(--text-2)" }}>
                    {formatSecondaryReason(row)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
