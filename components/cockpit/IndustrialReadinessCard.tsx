"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/coreFetch";
import type { ReadinessResponse } from "@/app/api/cockpit/readiness/route";
import type { ReadinessDecisionGetResponse } from "@/app/api/cockpit/readiness/decision/route";
import { ReadinessDrilldownModal } from "./ReadinessDrilldownModal";

const MAX_REASON_BADGES = 4;
const MAX_NOTE_TOOLTIP = 60;

function formatDecisionTime(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export type IndustrialReadinessCardProps = {
  shiftId: string | null;
};

export function IndustrialReadinessCard({ shiftId }: IndustrialReadinessCardProps) {
  const [data, setData] = useState<ReadinessResponse["readiness"] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [decision, setDecision] = useState<ReadinessDecisionGetResponse["decision"]>(null);

  useEffect(() => {
    if (!shiftId) {
      setData(null);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);
    fetchJson<ReadinessResponse>(`/api/cockpit/readiness?shift_id=${encodeURIComponent(shiftId)}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setError(true);
          setData(null);
          return;
        }
        if (res.data?.readiness) {
          setData(res.data.readiness);
          setError(false);
        } else {
          setError(true);
          setData(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  useEffect(() => {
    if (!shiftId) {
      setDecision(null);
      return;
    }
    let cancelled = false;
    fetchJson<ReadinessDecisionGetResponse>(
      `/api/cockpit/readiness/decision?shift_id=${encodeURIComponent(shiftId)}`
    )
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data?.decision) {
          setDecision(res.data.decision);
        } else {
          setDecision(null);
        }
      })
      .catch(() => {
        if (!cancelled) setDecision(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shiftId]);

  if (shiftId == null || shiftId === "") {
    return (
      <section
        className="rounded-lg border border-border bg-card p-4"
        data-testid="industrial-readiness-card"
      >
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Industrial Readiness</h2>
        <p className="text-sm text-muted-foreground">Select a shift to see readiness.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section
        className="rounded-lg border border-border bg-card p-4 animate-pulse"
        data-testid="industrial-readiness-card"
      >
        <div className="h-4 w-32 bg-muted rounded mb-3" />
        <div className="h-8 w-16 bg-muted rounded mb-2" />
        <div className="h-4 w-24 bg-muted rounded" />
      </section>
    );
  }

  if (error || !data) {
    return (
      <section
        className="rounded-lg border border-border bg-card p-4"
        data-testid="industrial-readiness-card"
      >
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Industrial Readiness</h2>
        <p className="text-sm text-muted-foreground">Readiness unavailable.</p>
      </section>
    );
  }

  const readiness = data;
  const score = Math.round(Number(readiness.readiness_score));
  const status = readiness.status === "GO" || readiness.status === "WARNING" || readiness.status === "NO_GO"
    ? readiness.status
    : "NO_GO";
  const statusClass =
    status === "GO"
      ? "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300/40"
      : status === "WARNING"
        ? "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border-amber-300/40"
        : "text-destructive bg-destructive/10 border-destructive/30";
  const reasonCodes = readiness.reason_codes ?? [];
  const visibleReasons = reasonCodes.slice(0, MAX_REASON_BADGES);
  const extraCount = reasonCodes.length - MAX_REASON_BADGES;
  const blockingCount = readiness.blocking_stations?.length ?? 0;

  return (
    <section
      className="rounded-lg border border-border bg-card p-4"
      data-testid="industrial-readiness-card"
    >
      <h2 className="text-sm font-medium text-muted-foreground mb-2">Industrial Readiness</h2>
      <div className="flex flex-wrap items-baseline gap-4">
        <span
          className={`text-3xl font-semibold tabular-nums ${
            status === "GO"
              ? "text-emerald-600 dark:text-emerald-400"
              : status === "WARNING"
                ? "text-amber-600 dark:text-amber-400"
                : "text-destructive"
          }`}
        >
          {score}
        </span>
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${statusClass}`}
          aria-label={`Status: ${status}`}
        >
          {status.replace("_", " ")}
        </span>
      </div>
      {reasonCodes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {visibleReasons.map((code) => (
            <span
              key={code}
              className="inline-flex rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground"
            >
              {code}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="inline-flex rounded border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">
              +{extraCount}
            </span>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {decision ? (
          <>
            <span className="text-muted-foreground">
              Decision: <span className="font-medium text-foreground">{decision.decision}</span>
              {decision.created_at && (
                <span className="text-muted-foreground"> · {formatDecisionTime(decision.created_at)}</span>
              )}
            </span>
            {decision.note && (
              <span
                className="text-muted-foreground truncate max-w-[200px] inline-block align-bottom"
                title={decision.note.length > MAX_NOTE_TOOLTIP ? decision.note.slice(0, MAX_NOTE_TOOLTIP) + "…" : decision.note}
              >
                {decision.note.length > MAX_NOTE_TOOLTIP ? decision.note.slice(0, MAX_NOTE_TOOLTIP) + "…" : decision.note}
              </span>
            )}
            <button
              type="button"
              onClick={() => setDrilldownOpen(true)}
              className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            >
              View / Change
            </button>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">No decision logged</span>
            <button
              type="button"
              onClick={() => setDrilldownOpen(true)}
              className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            >
              Log decision
            </button>
          </>
        )}
      </div>
      {status === "NO_GO" && blockingCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Blocking stations: <span className="font-medium tabular-nums text-foreground">{blockingCount}</span>
          </span>
          <button
            type="button"
            onClick={() => setDrilldownOpen(true)}
            className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          >
            Review blockers
          </button>
        </div>
      )}
      {(status === "GO" || status === "WARNING") && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setDrilldownOpen(true)}
            className="text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
          >
            View breakdown
          </button>
        </div>
      )}
      {shiftId && (
        <ReadinessDrilldownModal
          open={drilldownOpen}
          onOpenChange={setDrilldownOpen}
          shiftId={shiftId}
          readinessStatus={status}
          onDecisionSaved={setDecision}
        />
      )}
    </section>
  );
}
