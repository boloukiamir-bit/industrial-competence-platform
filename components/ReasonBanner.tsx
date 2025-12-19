"use client";

import { AlertCircle, Users, ClipboardList, Shield, Clock, RefreshCw, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type ReasonBannerState =
  | "missing_employees"
  | "missing_requirements"
  | "demo_mode"
  | "permission_issue"
  | "coming_soon"
  | "error"
  | "loading"
  | "empty";

interface ReasonBannerProps {
  state: ReasonBannerState;
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  onRetry?: () => void;
  onOpenDebug?: () => void;
}

const stateConfig: Record<ReasonBannerState, { icon: typeof AlertCircle; defaultTitle: string; defaultDescription: string; variant: "info" | "warning" | "error" }> = {
  missing_employees: {
    icon: Users,
    defaultTitle: "No employees found",
    defaultDescription: "Add employees to get started with competence tracking.",
    variant: "warning",
  },
  missing_requirements: {
    icon: ClipboardList,
    defaultTitle: "No requirements defined",
    defaultDescription: "Define position requirements to analyze skill gaps.",
    variant: "warning",
  },
  demo_mode: {
    icon: Shield,
    defaultTitle: "Demo Mode Active",
    defaultDescription: "You are viewing demo data. Changes will not be saved.",
    variant: "info",
  },
  permission_issue: {
    icon: Shield,
    defaultTitle: "Access restricted",
    defaultDescription: "You do not have permission to view this content.",
    variant: "warning",
  },
  coming_soon: {
    icon: Clock,
    defaultTitle: "Coming Soon",
    defaultDescription: "This feature is under development.",
    variant: "info",
  },
  error: {
    icon: AlertCircle,
    defaultTitle: "Something went wrong",
    defaultDescription: "An error occurred while loading this content.",
    variant: "error",
  },
  loading: {
    icon: RefreshCw,
    defaultTitle: "Loading...",
    defaultDescription: "Please wait while we load your data.",
    variant: "info",
  },
  empty: {
    icon: ClipboardList,
    defaultTitle: "No data yet",
    defaultDescription: "Get started by adding your first item.",
    variant: "info",
  },
};

const variantStyles: Record<"info" | "warning" | "error", string> = {
  info: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200",
  warning: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200",
  error: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200",
};

export function ReasonBanner({
  state,
  title,
  description,
  ctaLabel,
  ctaHref,
  onRetry,
  onOpenDebug,
}: ReasonBannerProps) {
  const config = stateConfig[state];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;
  const variantStyle = variantStyles[config.variant];

  return (
    <div
      className={`rounded-md border p-4 ${variantStyle}`}
      role="alert"
      data-testid={`banner-${state}`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{displayTitle}</h3>
          <p className="text-sm mt-1 opacity-90">{displayDescription}</p>
          
          <div className="flex flex-wrap gap-2 mt-3">
            {ctaHref && ctaLabel && (
              <Button asChild size="sm" variant="outline">
                <Link href={ctaHref} data-testid={`banner-cta-${state}`}>
                  {ctaLabel}
                </Link>
              </Button>
            )}
            
            {state === "error" && onRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={onRetry}
                data-testid="button-retry"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
            
            {state === "error" && onOpenDebug && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenDebug}
                data-testid="button-open-debug"
              >
                <Bug className="h-4 w-4 mr-1" />
                Open Debug
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NotConfiguredCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <Clock className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/app/setup" data-testid="link-setup">
            Return to Setup
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app/demo-center" data-testid="link-demo-center">
            See Demo Center
          </Link>
        </Button>
      </div>
    </div>
  );
}
