"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type StatusPillVariant = "BLOCKING" | "AT_RISK" | "OK";

const variantClasses: Record<StatusPillVariant, string> = {
  BLOCKING:
    "bg-[hsl(var(--ds-status-blocking-bg))] text-[hsl(var(--ds-status-blocking-text))] border-[hsl(var(--ds-status-blocking-text)/0.2)]",
  AT_RISK:
    "bg-[hsl(var(--ds-status-at-risk-bg))] text-[hsl(var(--ds-status-at-risk-text))] border-[hsl(var(--ds-status-at-risk-text)/0.25)]",
  OK: "bg-[hsl(var(--ds-status-ok-bg))] text-[hsl(var(--ds-status-ok-text))] border-[hsl(var(--ds-status-ok-text)/0.25)]",
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
  return "OK";
}
