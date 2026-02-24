/**
 * Deterministic governance event classification (category, severity, impact).
 * Shared server-only logic; must match Audit UI rules for consistent KPIs.
 * Does not inspect meta in v1.
 */

export type GovernanceEventCategory =
  | "REGULATORY"
  | "EXECUTION"
  | "COMPLIANCE"
  | "LEGITIMACY"
  | "SYSTEM";

export type GovernanceEventSeverity =
  | "INFO"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL";

export type GovernanceEventImpact = "BLOCKING" | "NON-BLOCKING";

/** Priority: REGULATORY > LEGITIMACY > COMPLIANCE > EXECUTION > SYSTEM. */
export function classifyGovernanceEvent(
  action?: string | null,
  targetType?: string | null
): GovernanceEventCategory {
  const a = (action ?? "").toUpperCase();
  const t = (targetType ?? "").toLowerCase();

  if (a.startsWith("REGULATORY_") || t === "regulatory_signal") return "REGULATORY";
  if (
    a.includes("LEGITIMACY") ||
    a.startsWith("GOVERNANCE_GATE_") ||
    a === "ALLOWED" ||
    a === "BLOCKED"
  )
    return "LEGITIMACY";
  if (a.startsWith("COMPLIANCE_") || t.includes("compliance")) return "COMPLIANCE";
  if (
    a.includes("DECISION") ||
    a.startsWith("COCKPIT_") ||
    a.startsWith("TOMORROWS_GAPS_")
  )
    return "EXECUTION";
  return "SYSTEM";
}

/** Priority: CRITICAL > HIGH > MEDIUM > LOW > INFO. Does not inspect meta. */
export function resolveGovernanceSeverity(
  category: GovernanceEventCategory,
  action?: string | null,
  targetType?: string | null,
  _meta?: unknown
): GovernanceEventSeverity {
  const a = (action ?? "").toUpperCase();
  void targetType;

  if (
    category === "LEGITIMACY" &&
    (a === "BLOCKED" || a.includes("LEGAL_STOP") || a.includes("NO_GO"))
  )
    return "CRITICAL";
  if (category === "REGULATORY" && a.includes("BLOCKED")) return "CRITICAL";
  if (category === "REGULATORY" || category === "LEGITIMACY") return "HIGH";
  if (category === "COMPLIANCE") return "MEDIUM";
  if (category === "EXECUTION") return "LOW";
  if (category === "SYSTEM") return "INFO";
  return "INFO";
}

export function resolveGovernanceImpact(
  sev: GovernanceEventSeverity
): GovernanceEventImpact {
  return sev === "CRITICAL" || sev === "HIGH" ? "BLOCKING" : "NON-BLOCKING";
}

/** Returns true iff the event is blocking (severity HIGH or CRITICAL). Safe for nulls. */
export function isBlockingGovernanceEvent(
  action?: string | null,
  targetType?: string | null,
  meta?: unknown
): boolean {
  const category = classifyGovernanceEvent(action, targetType);
  const severity = resolveGovernanceSeverity(
    category,
    action,
    targetType,
    meta
  );
  return resolveGovernanceImpact(severity) === "BLOCKING";
}
