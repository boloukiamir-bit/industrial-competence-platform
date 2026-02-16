"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusPillVariant = "BLOCKING" | "AT_RISK" | "OK" | "UNSTAFFED" | "ILLEGAL";

const variantClasses: Record<StatusPillVariant, string> = {
  BLOCKING:
    "bg-[hsl(var(--ds-status-blocking-bg))] text-[hsl(var(--ds-status-blocking-text))] border-[hsl(var(--ds-status-blocking-text)/0.2)]",
  AT_RISK:
    "bg-[hsl(var(--ds-status-at-risk-bg))] text-[hsl(var(--ds-status-at-risk-text))] border-[hsl(var(--ds-status-at-risk-text)/0.25)]",
  OK: "bg-[hsl(var(--ds-status-ok-bg))] text-[hsl(var(--ds-status-ok-text))] border-[hsl(var(--ds-status-ok-text)/0.25)]",
  UNSTAFFED:
    "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700",
  ILLEGAL:
    "bg-[hsl(var(--ds-status-blocking-bg))] text-[hsl(var(--ds-status-blocking-text))] border-[hsl(var(--ds-status-blocking-text)/0.2)]",
};

export interface StatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: StatusPillVariant;
  children?: React.ReactNode;
}

export function StatusPill({ variant, className, children, ...props }: StatusPillProps) {
  const label = children ?? variant.replace("_", " ");
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {label}
    </span>
  );
}

export function statusToPillVariant(severity: string): StatusPillVariant {
  if (severity === "BLOCKING" || severity === "NO_GO") return "BLOCKING";
  if (severity === "WARNING" || severity === "AT_RISK") return "AT_RISK";
  if (severity === "ILLEGAL") return "ILLEGAL";
  if (severity === "UNSTAFFED") return "UNSTAFFED";
  return "OK";
}

/** Cockpit issue_type to pill variant and display label. ILLEGAL = red, UNSTAFFED = distinct, NO_GO/WARNING as before. */
export function cockpitIssueTypeToVariant(
  issueType: string | undefined
): StatusPillVariant {
  const t = (issueType ?? "").toUpperCase().replace(/-/g, "_");
  if (t === "ILLEGAL") return "ILLEGAL";
  if (t === "UNSTAFFED") return "UNSTAFFED";
  if (t === "NO_GO") return "BLOCKING";
  if (t === "WARNING") return "AT_RISK";
  if (t === "GO") return "OK";
  return "AT_RISK";
}

export function cockpitIssueTypeToLabel(issueType: string | undefined): string {
  const t = (issueType ?? "").toUpperCase().replace(/-/g, "_");
  if (t === "ILLEGAL") return "ILLEGAL";
  if (t === "UNSTAFFED") return "UNSTAFFED";
  if (t === "NO_GO") return "Blocking";
  if (t === "WARNING") return "At risk";
  if (t === "GO") return "OK";
  return "At risk";
}
