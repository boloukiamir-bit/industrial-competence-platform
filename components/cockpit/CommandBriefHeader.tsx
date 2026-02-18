"use client";

import { cn } from "@/lib/utils";

/** Frontend-only thresholds for legal exposure level. */
function legalExposureLevel(points: number): "Low" | "Medium" | "High" {
  if (points >= 8000) return "High";
  if (points >= 2000) return "Medium";
  return "Low";
}

/** Derived production status from operations + compliance (classification only, no numeric merge). */
function productionStatus(
  blocking: number,
  complianceBlocked: number,
  fragilityIndex: number,
  complianceExposure: number
): "CRITICAL" | "UNSTABLE" | "STABLE" {
  if (blocking > 0 || complianceBlocked > 0) return "CRITICAL";
  if (fragilityIndex > 65 || complianceExposure > 8000) return "UNSTABLE";
  return "STABLE";
}

export type CommandBriefHeaderProps = {
  /** Open (unresolved) decisions count */
  openCount: number;
  /** Blocking count */
  blocking: number;
  /** At-risk (warning) count */
  atRisk: number;
  /** Fragility index 0–100 (operational only) */
  fragilityIndex: number;
  /** Delta vs previous day same shift/line: positive = higher risk. Omit when no comparison. */
  fragilityDelta?: number | null;
  /** Executive compliance: ready (produktionsklar) */
  complianceReady?: number;
  /** Executive compliance: not schedulable (blockers) */
  complianceBlocked?: number;
  /** Executive compliance: at risk (warnings) */
  complianceAtRisk?: number;
  /** Executive compliance: legal exposure (risk points) */
  complianceExposure?: number;
  /** True when any legal blockers exist for current filters */
  hasLegalBlockers?: boolean;
  /** False when compliance fetch failed or not yet loaded; show "—" and "No compliance data" */
  hasComplianceData?: boolean;
  /** Optional: loading state for values */
  loading?: boolean;
  /** Lightweight compliance summary chips */
  complianceSummary?: {
    legalBlockers: number;
    expiring30d: number;
    missing: number;
    validPct: number;
  } | null;
  complianceSummaryLoading?: boolean;
  /** Collapsed control-room mode while scrolling */
  collapsed?: boolean;
  className?: string;
};

export function CommandBriefHeader({
  openCount,
  blocking,
  atRisk,
  fragilityIndex,
  fragilityDelta,
  complianceReady = 0,
  complianceBlocked = 0,
  complianceAtRisk = 0,
  complianceExposure = 0,
  hasLegalBlockers = false,
  hasComplianceData = true,
  loading,
  complianceSummary,
  complianceSummaryLoading = false,
  collapsed = false,
  className,
}: CommandBriefHeaderProps) {
  const showLegalPlaceholder = !hasComplianceData || loading;

  const prodStatus = loading
    ? null
    : productionStatus(blocking, complianceBlocked, fragilityIndex, complianceExposure);
  const prodStatusClass =
    prodStatus === "CRITICAL"
      ? "text-destructive"
      : prodStatus === "UNSTABLE"
        ? "text-amber-600 dark:text-amber-500"
        : "text-emerald-600 dark:text-emerald-500";
  const prodStatusBarClass =
    prodStatus === "CRITICAL"
      ? "cockpit-brief-production-bar--critical"
      : prodStatus === "UNSTABLE"
        ? "cockpit-brief-production-bar--unstable"
        : "cockpit-brief-production-bar--stable";

  const legalStatus =
    hasComplianceData && !loading
      ? hasLegalBlockers
        ? { text: "LEGAL BLOCKERS — cannot schedule", className: "text-destructive" }
        : complianceAtRisk > 0
          ? { text: "AT RISK — expiring soon", className: "text-amber-600 dark:text-amber-500" }
          : { text: "CLEAR — legal ready", className: "text-emerald-600 dark:text-emerald-500" }
      : null;

  const exposureLevel =
    hasComplianceData && !loading ? legalExposureLevel(complianceExposure) : null;
  const exposureLabel =
    hasComplianceData && !loading
      ? hasLegalBlockers
        ? exposureLevel
        : complianceExposure > 0
          ? "Review"
          : "OK"
      : null;
  const exposureLevelClass =
    hasLegalBlockers
      ? "text-destructive"
      : complianceExposure > 0
        ? "text-amber-600 dark:text-amber-500"
        : "text-muted-foreground";

  const isCalm =
    !loading &&
    fragilityIndex === 0 &&
    blocking === 0 &&
    atRisk === 0 &&
    openCount === 0;
  const isStable = isCalm;

  const legalBadge = (() => {
    if (showLegalPlaceholder) {
      return { label: "Legal —", className: "text-[11px] text-muted-foreground px-2 py-1 rounded bg-muted/50" };
    }
    if (isStable && !hasLegalBlockers) {
      return { label: "Legal OK · 0 pts", className: "text-[11px] text-muted-foreground px-2 py-1 rounded bg-muted/50" };
    }
    if (!hasLegalBlockers && complianceExposure > 0) {
      return {
        label: `Legal Review · +${complianceExposure} pts`,
        className:
          "text-[11px] px-2 py-1 rounded bg-muted/50 tabular-nums text-amber-600 dark:text-amber-500",
      };
    }
    if (!hasLegalBlockers) {
      return { label: "Legal OK · 0 pts", className: "text-[11px] text-muted-foreground px-2 py-1 rounded bg-muted/50" };
    }
    return {
      label: `Legal High · +${complianceExposure} pts`,
      className: "text-[11px] px-2 py-1 rounded bg-muted/50 tabular-nums text-destructive",
    };
  })();

  const showComplianceChips = !collapsed && (complianceSummaryLoading || complianceSummary != null);
  const chipValue = (value?: number) =>
    complianceSummaryLoading ? "—" : value != null ? String(value) : "—";

  return (
    <header
      className={cn(
        "cockpit-brief-header",
        collapsed ? "px-0 py-0" : "px-4 sm:px-6",
        className
      )}
      data-testid="command-brief-header"
    >
      {collapsed ? (
        <div className="h-12 px-3 flex items-center gap-3 text-[12px] min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                prodStatus === "CRITICAL"
                  ? "bg-destructive/10 text-destructive border border-destructive/30"
                  : prodStatus === "UNSTABLE"
                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-300/40"
                    : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300/40"
              )}
              aria-label={`Production status: ${prodStatus ?? "loading"}`}
            >
              {prodStatus ?? "—"}
            </span>
            <span className="text-muted-foreground tabular-nums truncate min-w-0 flex-1">
              Fragility {loading ? "—" : fragilityIndex} · Blocking {loading ? "—" : blocking} · At risk{" "}
              {loading ? "—" : atRisk} · Open {loading ? "—" : openCount}
            </span>
          </div>
          <div className="shrink-0">
            <span className={legalBadge.className} aria-label={legalBadge.label}>
              {legalBadge.label}
            </span>
          </div>
        </div>
      ) : isCalm ? (
        <>
          {/* Compact single row when all KPIs are zero */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 py-2"
            role="region"
            aria-label="Production status"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0"
                aria-hidden
              />
              <span
                className="text-sm font-medium text-emerald-600 dark:text-emerald-500"
                aria-live="polite"
                aria-label="Production status: stable"
              >
                Production: STABLE
              </span>
            </div>
            <div className="flex items-center gap-x-3 text-[12px] text-muted-foreground tabular-nums">
              <span>Fragility {fragilityIndex}</span>
              <span aria-hidden>•</span>
              <span>Blocking {blocking}</span>
              <span aria-hidden>•</span>
              <span>At risk {atRisk}</span>
              <span aria-hidden>•</span>
              <span>Open {openCount}</span>
            </div>
            <div className="shrink-0">
              <span className={legalBadge.className} aria-label={legalBadge.label}>
                {legalBadge.label}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* PRODUCTION STATUS — top-level, above operations */}
          <div className="cockpit-brief-production">
            <span className="cockpit-brief-production-label" aria-hidden>
              PRODUCTION STATUS
            </span>
            <span
              className={cn("cockpit-brief-production-value tabular-nums", prodStatusClass)}
              aria-label={`Production status: ${prodStatus ?? "loading"}`}
            >
              {prodStatus ?? "—"}
            </span>
            {prodStatus && (
              <div
                className={cn("cockpit-brief-production-bar", prodStatusBarClass)}
                aria-hidden
                role="presentation"
              />
            )}
            {fragilityDelta != null && (
              <span
                className={cn(
                  "cockpit-brief-production-delta text-[0.75rem] tabular-nums",
                  fragilityDelta > 0
                    ? "text-destructive"
                    : fragilityDelta < 0
                      ? "text-emerald-600 dark:text-emerald-500"
                      : "text-muted-foreground"
                )}
                aria-label={`Fragility vs previous day: ${fragilityDelta > 0 ? "up" : fragilityDelta < 0 ? "down" : "no change"} ${Math.abs(fragilityDelta)}`}
              >
                {fragilityDelta > 0 && "▲ +"}
                {fragilityDelta < 0 && "▼ −"}
                {fragilityDelta !== 0 && Math.abs(fragilityDelta)}
                {fragilityDelta === 0 && "No change"}
              </span>
            )}
          </div>

          {/* OPERATIONS — fragility dominant */}
          <div className="cockpit-brief-grid">
            <div className="cockpit-brief-anchor">
              <span className="cockpit-brief-anchor-label">Fragility</span>
              <span
                className="cockpit-brief-anchor-value tabular-nums"
                aria-label="Fragility index"
              >
                {loading ? "—" : fragilityIndex}
              </span>
            </div>
            <div className="cockpit-brief-metrics">
              <div className="cockpit-brief-metric">
                <span className="cockpit-brief-metric-label">Blocking</span>
                <span className="cockpit-brief-metric-value tabular-nums" aria-label="Blocking count">
                  {loading ? "—" : blocking}
                </span>
              </div>
              <div className="cockpit-brief-metric">
                <span className="cockpit-brief-metric-label">At risk</span>
                <span className="cockpit-brief-metric-value tabular-nums" aria-label="At risk count">
                  {loading ? "—" : atRisk}
                </span>
              </div>
              <div className="cockpit-brief-metric">
                <span className="cockpit-brief-metric-label">Open</span>
                <span className="cockpit-brief-metric-value tabular-nums" aria-label="Open decisions count">
                  {loading ? "—" : openCount}
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* LEGAL READINESS — header row with status; 4 tiles (hidden in compact; show only in expanded or as inline badge in compact) */}
      {!collapsed && !isCalm && (
      <div className="mt-6">
        <div className="cockpit-brief-legal-header">
          <span className="cockpit-brief-legal-label">Legal readiness</span>
          {legalStatus && (
            <span
              className={cn(
                "cockpit-brief-legal-status text-[0.5rem] font-medium uppercase tracking-tight",
                legalStatus.className
              )}
              aria-label="Legal readiness status"
            >
              {legalStatus.text}
            </span>
          )}
        </div>
        {showLegalPlaceholder && !loading && (
          <p className="cockpit-brief-legal-no-data text-[0.5rem] text-muted-foreground mt-0.5 mb-2">
            No compliance data
          </p>
        )}
        <div className="cockpit-brief-legal-grid">
          <div className="cockpit-brief-legal-tile">
            <span className="cockpit-brief-legal-tile-label">Produktionsklar</span>
            <span className="cockpit-brief-legal-tile-value tabular-nums text-foreground/90" aria-label="Produktionsklar">
              {showLegalPlaceholder ? "—" : complianceReady}
            </span>
          </div>
          <div className="cockpit-brief-legal-tile">
            <span className="cockpit-brief-legal-tile-label flex items-center gap-1.5">
              Ej schemabar
              {!showLegalPlaceholder && hasLegalBlockers && (
                <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" aria-hidden />
              )}
            </span>
            <span className="cockpit-brief-legal-tile-value tabular-nums text-destructive" aria-label="Ej schemabar">
              {showLegalPlaceholder ? "—" : complianceBlocked}
            </span>
          </div>
          <div className="cockpit-brief-legal-tile">
            <span className="cockpit-brief-legal-tile-label">At risk</span>
            <span className="cockpit-brief-legal-tile-value tabular-nums text-amber-600 dark:text-amber-500" aria-label="Compliance at risk">
              {showLegalPlaceholder ? "—" : complianceAtRisk}
            </span>
          </div>
          <div className="cockpit-brief-legal-tile">
            <span className="cockpit-brief-legal-tile-label">Legal exposure</span>
            {showLegalPlaceholder ? (
              <span className="cockpit-brief-legal-tile-value tabular-nums text-muted-foreground" aria-label="Legal exposure">
                —
              </span>
            ) : (
              <>
                <span className={cn("text-[0.5rem] font-medium uppercase tracking-tight", exposureLevelClass)} aria-hidden>
                  {exposureLabel ?? "—"}
                </span>
                <span className="cockpit-brief-legal-tile-value tabular-nums text-muted-foreground" aria-label="Legal exposure risk points">
                  {complianceExposure}
                </span>
                <span className="text-[0.5rem] uppercase tracking-wider text-muted-foreground/80 mt-0.5">
                  {complianceExposure} risk points
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {showComplianceChips && (
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]" data-testid="compliance-summary-chips">
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-muted-foreground">
            Legal stoppers{" "}
            <span className="font-medium text-foreground tabular-nums">
              {chipValue(complianceSummary?.legalBlockers)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-muted-foreground">
            Expiring 30d{" "}
            <span className="font-medium text-foreground tabular-nums">
              {chipValue(complianceSummary?.expiring30d)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-muted-foreground">
            Missing{" "}
            <span className="font-medium text-foreground tabular-nums">
              {chipValue(complianceSummary?.missing)}
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-1 text-muted-foreground">
            Valid %{" "}
            <span className="font-medium text-foreground tabular-nums">
              {complianceSummaryLoading
                ? "—"
                : complianceSummary?.validPct != null
                  ? `${complianceSummary.validPct}%`
                  : "—"}
            </span>
          </span>
        </div>
      )}
    </header>
  );
}
