"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  headline: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ headline, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-8 px-4 cockpit-body",
        !className?.includes("cockpit-card") && "cockpit-card",
        className
      )}
      {...props}
    >
      <p className="cockpit-title mb-1">{headline}</p>
      {description && <p className="cockpit-label mb-4 max-w-sm">{description}</p>}
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
