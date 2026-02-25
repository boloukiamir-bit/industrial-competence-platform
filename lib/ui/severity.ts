/**
 * Severity Calibration Layer - central mapping from governance/signals to UI.
 */

export type SeverityLevel =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NEUTRAL";

export type SeveritySignals = {
  legitimacy?: string;
  readiness?: string;
  overdue?: boolean;
  dueSoon?: boolean;
  unassigned?: boolean;
};

export function getSeverityFromSignals(input: SeveritySignals): SeverityLevel {
  if (input.legitimacy === "LEGAL_STOP") return "CRITICAL";
  if (input.readiness === "NO_GO") return "HIGH";
  if (input.readiness === "WARNING") return "MEDIUM";
  if (input.overdue === true) return "HIGH";
  if (input.dueSoon === true) return "MEDIUM";
  if (input.unassigned === true) return "LOW";
  return "NEUTRAL";
}

export type BadgeVariantResult = {
  variant: "destructive" | "secondary" | "outline";
  className?: string;
};

export function severityToBadgeVariant(level: SeverityLevel): BadgeVariantResult {
  switch (level) {
    case "CRITICAL":
      return { variant: "destructive" };
    case "HIGH":
      return {
        variant: "secondary",
        className: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",
      };
    case "MEDIUM":
      return {
        variant: "secondary",
        className: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-200 dark:border-yellow-800",
      };
    case "LOW":
      return { variant: "outline", className: "text-muted-foreground border-border" };
    case "NEUTRAL":
    default:
      return { variant: "outline" };
  }
}

export function severityToKpiTileChipVariant(
  level: SeverityLevel
): "default" | "blocking" | "warning" | "ok" {
  switch (level) {
    case "CRITICAL":
      return "blocking";
    case "HIGH":
    case "MEDIUM":
      return "warning";
    case "LOW":
    case "NEUTRAL":
    default:
      return "default";
  }
}

export function severityToPillClassName(level: SeverityLevel): string {
  switch (level) {
    case "CRITICAL":
      return "border-red-300 bg-red-50/80 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200";
    case "HIGH":
      return "border-amber-300 bg-amber-50/80 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200";
    case "MEDIUM":
      return "border-yellow-300 bg-yellow-50/80 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-200";
    case "LOW":
    case "NEUTRAL":
    default:
      return "border-border bg-muted/30 text-muted-foreground";
  }
}
