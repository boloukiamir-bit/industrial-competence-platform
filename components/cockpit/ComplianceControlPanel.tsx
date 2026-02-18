"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchJson } from "@/lib/coreFetch";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";

type ComplianceStatus = "valid" | "expiring" | "expired" | "missing" | "waived";

type ComplianceMatrixRosterResponse = {
  ok: boolean;
  roster_employees_count?: number;
  kpis?: {
    total_roster_employees: number;
    blockers_count: number;
    expiring_count: number;
    valid_count: number;
    missing_count: number;
    missing_blocking_count: number;
    missing_nonblocking_count: number;
  };
  top_blockers?: Array<{
    employee_id: string;
    employee_name: string;
    employee_number: string | null;
    items: Array<{ compliance_id: string; code: string; name: string; status: string; valid_to: string | null; days_left: number | null }>;
  }>;
  top_commercial_risks?: Array<{
    employee_id: string;
    employee_name: string;
    employee_number: string | null;
    items: Array<{ compliance_id: string; code: string; name: string; status: string; valid_to: string | null; days_left: number | null }>;
  }>;
  error?: string;
};

type ComplianceControlPanelProps = {
  className?: string;
};

type KpiTotals = {
  valid: number;
  expiring: number;
  expired: number;
  missing: number;
};

const EMPTY_TOTALS: KpiTotals = {
  valid: 0,
  expiring: 0,
  expired: 0,
  missing: 0,
};

function formatCount(value: number | null): string {
  if (value == null) return "--";
  return value.toLocaleString();
}

function formatPercent(value: number | null): string {
  if (value == null) return "--";
  return `${value}%`;
}

export function ComplianceControlPanel({ className }: ComplianceControlPanelProps) {
  const router = useRouter();
  const { date, shiftType } = useCockpitFilters();
  const [data, setData] = useState<ComplianceMatrixRosterResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllCommercial, setShowAllCommercial] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (date) params.set("date", date);
    if (shiftType) params.set("shift_code", shiftType);
    const url = `/api/compliance/matrix?${params.toString()}`;
    fetchJson<ComplianceMatrixRosterResponse>(url)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(res.error ?? "Failed to load compliance matrix");
          setData(null);
          return;
        }
        if (!res.data?.ok) {
          setError(res.data?.error ?? "Failed to load compliance matrix");
          setData(null);
          return;
        }
        setData(res.data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load compliance overview");
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date, shiftType]);

  const totals = useMemo(() => {
    if (!data?.kpis) return { ...EMPTY_TOTALS };
    return {
      valid: data.kpis.valid_count ?? 0,
      expiring: data.kpis.expiring_count ?? 0,
      expired: data.kpis.blockers_count ?? 0,
      missing: data.kpis.missing_count ?? 0,
    };
  }, [data?.kpis]);

  const expiring7 = null;

  const totalRelevant = totals.valid + totals.expiring + totals.expired + totals.missing;
  const validPercent =
    totalRelevant > 0 ? Math.round((totals.valid / totalRelevant) * 100) : null;

  const ready = !loading && !error && data?.ok;
  const expiredCount = totals.expired;
  const expiringCount = totals.expiring;
  const missingCount = totals.missing;
  const showLegalAlert = ready && expiredCount > 0;
  const rosterCount = data?.roster_employees_count ?? 0;
  const showNoRoster = ready && rosterCount === 0;
  const missingNonblocking = data?.kpis?.missing_nonblocking_count ?? 0;
  const commercialRisks = useMemo(() => {
    const raw = data?.top_commercial_risks ?? [];
    return [...raw].sort((a, b) => {
      const countDiff = (b.items?.length ?? 0) - (a.items?.length ?? 0);
      if (countDiff !== 0) return countDiff;

      const aNumRaw = (a.employee_number ?? "").toString().trim();
      const bNumRaw = (b.employee_number ?? "").toString().trim();

      const aNum = Number.parseInt(aNumRaw, 10);
      const bNum = Number.parseInt(bNumRaw, 10);

      const aHas = Number.isFinite(aNum);
      const bHas = Number.isFinite(bNum);

      if (aHas && bHas) return aNum - bNum;

      return aNumRaw.localeCompare(bNumRaw);
    });
  }, [data?.top_commercial_risks]);
  const visibleCommercialRisks = showAllCommercial ? commercialRisks : commercialRisks.slice(0, 3);

  useEffect(() => {
    if (showNoRoster) {
      console.log("[compliance] No staffed employees on roster", { date, shift_code: shiftType });
    }
  }, [showNoRoster, date, shiftType]);

  const handleMatrixFilter = (status: "expired" | "missing") => {
    const params = new URLSearchParams();
    params.set("tab", status);
    router.push(`/app/compliance/matrix?${params.toString()}`);
  };

  return (
    <section className={cn("mt-4", className)} aria-label="Compliance control panel">
      <div
        className={cn(
          "rounded-2xl border border-slate-800 bg-slate-950/95 text-slate-100",
          "px-4 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.25)]",
          showLegalAlert && "border-l-4 border-l-red-500"
        )}
        data-testid="compliance-control-panel"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
              Compliance control
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Compliance Control Panel</h3>
          </div>
          {showLegalAlert && (
            <span className="rounded-md border border-red-500/60 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red-300">
              ILLEGAL TO OPERATE
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div
            className={cn(
              "rounded-xl border px-3 py-2",
              showLegalAlert ? "border-red-500/50 bg-red-500/5" : "border-slate-800 bg-slate-900/40"
            )}
          >
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Expired</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                showLegalAlert ? "text-red-300" : "text-slate-100"
              )}
            >
              {ready ? formatCount(expiredCount) : "--"}
            </p>
          </div>

          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-amber-200">Expiring</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">
              {ready ? formatCount(expiringCount) : "--"}
            </p>
            <p className="text-[11px] text-amber-200/70">
              7d {ready ? formatCount(expiring7) : "--"} / 30d {ready ? formatCount(expiringCount) : "--"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Missing</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
              {ready ? formatCount(missingCount) : "--"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-400">Valid %</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-100">
              {ready ? formatPercent(validPercent) : "--"}
            </p>
          </div>
        </div>

        {showNoRoster && (
          <p className="mt-3 text-[11px] text-slate-400">
            No staffed employees on roster.
          </p>
        )}
        {ready && missingNonblocking > 0 && commercialRisks.length > 0 && (
          <details className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/5 px-3 py-2">
            <summary className="cursor-pointer text-[13px] font-semibold text-amber-200">
              Customer / Commercial Risk
            </summary>
            <p className="mt-2 text-[12px] text-amber-100/80">
              {formatCount(missingNonblocking)} missing customer requirements (non-blocking).
            </p>
            <div className="mt-3 space-y-2">
              {visibleCommercialRisks.map((entry) => (
                <div
                  key={entry.employee_id}
                  className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2"
                >
                  <p className="text-[12px] font-semibold text-amber-100">
                    {entry.employee_number ?? "—"} · {entry.employee_name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {entry.items.map((item) => (
                      <span
                        key={item.compliance_id}
                        className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-100"
                      >
                        {item.code} · {item.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {commercialRisks.length > 3 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-amber-500/50 bg-transparent text-[12px] text-amber-100 hover:bg-amber-500/10"
                  onClick={() => setShowAllCommercial((prev) => !prev)}
                >
                  {showAllCommercial ? "Show less" : `Show more (${commercialRisks.length - 3})`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full border-amber-500/50 bg-transparent text-[12px] text-amber-100 hover:bg-amber-500/10"
                  onClick={() => handleMatrixFilter("missing")}
                >
                  Review Missing
                </Button>
              </div>
            )}
          </details>
        )}
        {error && (
          <p className="mt-3 text-[11px] text-red-300">
            Compliance overview unavailable. Reload to retry.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-slate-700 bg-transparent text-[12px] text-slate-200 hover:bg-slate-900"
            onClick={() => handleMatrixFilter("expired")}
          >
            View Critical
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-slate-700 bg-transparent text-[12px] text-slate-200 hover:bg-slate-900"
            onClick={() => handleMatrixFilter("missing")}
          >
            Review Missing
          </Button>
          <Button
            size="sm"
            className="h-8 rounded-full bg-slate-200 text-[12px] font-semibold text-slate-900 hover:bg-white"
            onClick={() => router.push("/app/compliance/matrix?tab=expired")}
          >
            Open Matrix
          </Button>
        </div>
      </div>
    </section>
  );
}
