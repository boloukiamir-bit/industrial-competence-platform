"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";
import { PageFrame } from "@/components/layout/PageFrame";
import { fetchJson } from "@/lib/coreFetch";
import type {
  CockpitSummaryV2Response,
  ProductionReadiness,
  LegalReadiness,
  CriticalGapRow,
  HrBlockers,
} from "@/app/api/cockpit/summary-v2/route";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";
import { IndustrialReadinessCard } from "@/components/cockpit/IndustrialReadinessCard";

function CockpitSkeleton() {
  return (
    <PageFrame>
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-32 bg-muted rounded-lg" />
      </div>
    </PageFrame>
  );
}

export default function CockpitPage() {
  const { date, shiftType, shiftOptions, line, setDate, setShiftType, setLine } = useCockpitFilters();
  const [summary, setSummary] = useState<CockpitSummaryV2Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableLines, setAvailableLines] = useState<string[]>([]);
  const [shiftId, setShiftId] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("shift_code", shiftType);
  if (line && line !== "all") params.set("line", line);
  const summaryUrl = `/api/cockpit/summary-v2?${params.toString()}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchJson<CockpitSummaryV2Response>(summaryUrl)
      .then((res) => {
        if (!res.ok) {
          setError(res.error ?? "Failed to load summary");
          setSummary(null);
          return;
        }
        if (!cancelled) {
          setSummary(res.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load summary");
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [summaryUrl]);

  useEffect(() => {
    const p = new URLSearchParams({ date, shift_code: shiftType });
    fetchJson<{ lines?: string[] }>(`/api/cockpit/lines?${p.toString()}`)
      .then((res) => {
        if (!res.ok) return;
        setAvailableLines(res.data?.lines ?? []);
      })
      .catch(() => {});
  }, [date, shiftType]);

  useEffect(() => {
    if (!date || !shiftType) {
      setShiftId(null);
      return;
    }
    const p = new URLSearchParams({ date, shift_code: shiftType });
    fetchJson<{ ok?: boolean; shift_ids?: string[] }>(`/api/cockpit/shift-ids?${p.toString()}`)
      .then((res) => {
        if (!res.ok) {
          setShiftId(null);
          return;
        }
        const ids = res.data?.shift_ids ?? [];
        setShiftId(ids[0] ?? null);
      })
      .catch(() => setShiftId(null));
  }, [date, shiftType]);

  const lineOptions = (availableLines ?? []).filter((l) => !isLegacyLine(l));

  const filterBar = (
    <header className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 px-2 rounded border border-input bg-background text-sm"
        data-testid="input-date"
      />
      <Select value={shiftType} onValueChange={setShiftType}>
        <SelectTrigger className="h-8 w-[110px] px-2 text-sm" data-testid="select-shift">
          <SelectValue placeholder="Shift" />
        </SelectTrigger>
        <SelectContent>
          {shiftOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={line} onValueChange={setLine}>
        <SelectTrigger className="h-8 w-[110px] px-2 text-sm" data-testid="select-line">
          <SelectValue placeholder="Line" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Lines</SelectItem>
          {lineOptions.map((l) => (
            <SelectItem key={l} value={l}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </header>
  );

  if (error) {
    return (
      <PageFrame filterBar={filterBar}>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      </PageFrame>
    );
  }

  if (loading) {
    return <CockpitSkeleton />;
  }

  const noData = summary?.no_data ?? true;
  const pr = summary?.production_readiness;
  const lr = summary?.legal_readiness;
  const gaps = summary?.critical_gaps ?? [];
  const hrBlockers = summary?.hr_blockers ?? { overdue_required_steps: 0, blocked_steps: 0 };

  return (
    <PageFrame filterBar={filterBar}>
      <div className="space-y-6 max-w-4xl">
        <IndustrialReadinessCard shiftId={shiftId} />
        <div id="issue-inbox" className="space-y-6" tabIndex={-1}>
          {noData ? (
            <p className="text-muted-foreground text-sm py-6" data-testid="cockpit-no-data">
              No data for selected shift.
            </p>
          ) : (
            <>
              <ProductionReadinessBlock data={pr!} />
              <LegalReadinessBlock data={lr!} />
              <CriticalGapsBlock gaps={gaps} />
              <HrBlockersBlock data={hrBlockers} />
            </>
          )}
        </div>
      </div>
    </PageFrame>
  );
}

function ProductionReadinessBlock({ data }: { data: ProductionReadiness }) {
  const { total_stations, staffed_stations, unstaffed_stations, readiness_percent, status } = data;
  const statusClass =
    status === "GO"
      ? "text-emerald-600 dark:text-emerald-400"
      : status === "WARNING"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      data-testid="cockpit-production-readiness"
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Production Readiness</h2>
      <div className="flex flex-wrap items-baseline gap-4">
        <span className={`text-3xl font-semibold tabular-nums ${statusClass}`}>
          {readiness_percent}%
        </span>
        <span className={`font-medium ${statusClass}`}>{status}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        {staffed_stations} staffed / {total_stations} stations ({unstaffed_stations} unstaffed)
      </p>
    </section>
  );
}

function LegalReadinessBlock({ data }: { data: LegalReadiness }) {
  const {
    employees_with_expired,
    employees_missing_mandatory,
    total_assigned,
    status,
  } = data;
  const statusClass =
    status === "LEGAL_STOP"
      ? "text-destructive"
      : status === "WARNING"
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-600 dark:text-emerald-400";
  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      data-testid="cockpit-legal-readiness"
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Legal Readiness</h2>
      <div className="flex flex-wrap items-baseline gap-4">
        <span className={`text-xl font-semibold ${statusClass}`}>{status}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Assigned: {total_assigned}. Expired: {employees_with_expired}. Missing mandatory:{" "}
        {employees_missing_mandatory}
      </p>
    </section>
  );
}

function CriticalGapsBlock({ gaps }: { gaps: CriticalGapRow[] }) {
  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      data-testid="cockpit-critical-gaps"
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Critical Gaps (Top 5)</h2>
      {gaps.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skill gaps above threshold.</p>
      ) : (
        <ul className="list-none space-y-1.5 text-sm">
          {gaps.map((g) => (
            <li key={g.station_id} className="flex justify-between gap-2">
              <span>
                {g.station_code ?? g.station_name ?? g.station_id}
                {g.gap_count > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({g.gap_count} gap{g.gap_count !== 1 ? "s" : ""}, severity {g.severity})
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function HrBlockersBlock({ data }: { data: HrBlockers }) {
  const { overdue_required_steps, blocked_steps } = data;
  const total = overdue_required_steps + blocked_steps;
  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      data-testid="cockpit-hr-blockers"
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-2">HR Blockers</h2>
      <p className="text-sm">
        Overdue required steps: <span className="font-medium tabular-nums">{overdue_required_steps}</span>
        {" · "}
        Blocked: <span className="font-medium tabular-nums">{blocked_steps}</span>
        {total > 0 && (
          <span className="ml-1 text-amber-600 dark:text-amber-400">({total} total)</span>
        )}
      </p>
    </section>
  );
}
