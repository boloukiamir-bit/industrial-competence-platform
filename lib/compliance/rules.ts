/**
 * Compliance rule evaluation layer (Daniel pilot v1).
 * Determines REQUIRED compliance codes for a given employee context and evaluates status buckets + risk.
 * Tenant-safe: callers must pass org_id and site_id; no hardcoded org/site.
 */

import {
  WORK_ENVIRONMENT_CODES,
  MEDICAL_CONTROL_CODES,
  MEDICAL_TRAINING_CODES,
  CUSTOMER_REQUIREMENT_CODES,
  SUSTAINABILITY_CODES,
} from "./catalogCodes";

export type EmployeeContext = {
  org_id: string;
  site_id: string | null;
  employee_id?: string;
  shift_code: string;
  station_id?: string | null;
  role_code?: string | null;
  customer_code?: string | null;
};

/** Normalize shift for rule matching: Day/Evening/Night or raw code */
function normalizeShift(shiftCode: string): string {
  const s = shiftCode.trim();
  const lower = s.toLowerCase();
  if (lower === "night" || lower === "3" || lower === "fm") return "Night";
  if (lower === "evening" || lower === "2" || lower === "em") return "Evening";
  if (lower === "day" || lower === "1") return "Day";
  return s;
}

/**
 * Returns the list of compliance codes required for the given context.
 * Shift-based: Night -> NIGHT_EXAM; customer IKEA -> IKEA_*; work_environment + sustainability always.
 */
export function requiredComplianceForContext(ctx: EmployeeContext): string[] {
  const shift = normalizeShift(ctx.shift_code);
  const customer = (ctx.customer_code ?? "").trim().toUpperCase();
  const required: string[] = [];

  // Always required (work environment + base medical + sustainability)
  required.push(...WORK_ENVIRONMENT_CODES);
  required.push(...SUSTAINABILITY_CODES);

  // Medical control: NIGHT_EXAM only for Night shift; others required for all (v1)
  if (shift === "Night") {
    required.push("NIGHT_EXAM");
  }
  required.push(
    "EPOXY_EXAM",
    "HAND_INTENSIVE_EXAM",
    "HEARING_TEST",
    "VISION_TEST",
    "GENERAL_HEALTH"
  );

  // Medical training
  required.push(...MEDICAL_TRAINING_CODES);

  // Customer-specific
  if (customer === "IKEA") {
    required.push(...CUSTOMER_REQUIREMENT_CODES);
  }

  return [...new Set(required)];
}

export type ComplianceStatusBucket =
  | "valid"
  | "expiring_30"
  | "expiring_7"
  | "expired"
  | "missing";

export type ComplianceItemStatus = {
  code: string;
  bucket: ComplianceStatusBucket;
  valid_to: string | null;
  days_left: number | null;
  waived: boolean;
};

/** Risk points per bucket (Daniel pilot v1) */
export const COMPLIANCE_RISK_POINTS: Record<ComplianceStatusBucket, number> = {
  valid: 0,
  expiring_30: 3,
  expiring_7: 6,
  expired: 12,
  missing: 20,
};

const EXPIRING_30_DAYS = 30;
const EXPIRING_7_DAYS = 7;

/**
 * Compute status bucket and days left for one compliance item.
 */
export function bucketComplianceStatus(
  validTo: string | null,
  waived: boolean,
  asOf: Date = new Date()
): { bucket: ComplianceStatusBucket; daysLeft: number | null } {
  if (waived) {
    return { bucket: "valid", daysLeft: null };
  }
  if (!validTo) {
    return { bucket: "missing", daysLeft: null };
  }
  const to = new Date(validTo);
  to.setHours(0, 0, 0, 0);
  const ref = new Date(asOf);
  ref.setHours(0, 0, 0, 0);
  const daysLeft = Math.ceil((to.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  if (to < ref) return { bucket: "expired", daysLeft };
  if (daysLeft <= EXPIRING_7_DAYS) return { bucket: "expiring_7", daysLeft };
  if (daysLeft <= EXPIRING_30_DAYS) return { bucket: "expiring_30", daysLeft };
  return { bucket: "valid", daysLeft };
}

export type EmployeeComplianceRecord = {
  code: string;
  valid_to: string | null;
  waived: boolean;
};

/**
 * Evaluate one employee's compliance against required codes.
 * Records must be keyed by code (from catalog + employee_compliance join).
 */
export function evaluateEmployeeCompliance(
  requiredCodes: string[],
  recordsByCode: Map<string, EmployeeComplianceRecord>,
  asOf: Date = new Date()
): {
  required_compliance_codes: string[];
  missing: string[];
  expired: string[];
  expiring_7: string[];
  expiring_30: string[];
  valid: string[];
  risk_points: number;
  items: ComplianceItemStatus[];
} {
  const missing: string[] = [];
  const expired: string[] = [];
  const expiring_7: string[] = [];
  const expiring_30: string[] = [];
  const valid: string[] = [];
  const items: ComplianceItemStatus[] = [];
  let risk_points = 0;

  for (const code of requiredCodes) {
    const rec = recordsByCode.get(code);
    const validTo = rec?.valid_to ?? null;
    const waived = rec?.waived ?? false;
    const { bucket, daysLeft } = bucketComplianceStatus(validTo, waived, asOf);

    items.push({
      code,
      bucket,
      valid_to: validTo,
      days_left: daysLeft,
      waived,
    });

    switch (bucket) {
      case "missing":
        missing.push(code);
        risk_points += COMPLIANCE_RISK_POINTS.missing;
        break;
      case "expired":
        expired.push(code);
        risk_points += COMPLIANCE_RISK_POINTS.expired;
        break;
      case "expiring_7":
        expiring_7.push(code);
        risk_points += COMPLIANCE_RISK_POINTS.expiring_7;
        break;
      case "expiring_30":
        expiring_30.push(code);
        risk_points += COMPLIANCE_RISK_POINTS.expiring_30;
        break;
      case "valid":
        valid.push(code);
        risk_points += COMPLIANCE_RISK_POINTS.valid;
        break;
    }
  }

  return {
    required_compliance_codes: requiredCodes,
    missing,
    expired,
    expiring_7,
    expiring_30,
    valid,
    risk_points,
    items,
  };
}

/** Blocker = missing or expired mandatory compliance (for cockpit) */
export function complianceBlockersFromEvaluation(evalResult: ReturnType<typeof evaluateEmployeeCompliance>): string[] {
  return [...evalResult.missing, ...evalResult.expired];
}

/** Warning = expiring within 30 days (for cockpit) */
export function complianceWarningsFromEvaluation(evalResult: ReturnType<typeof evaluateEmployeeCompliance>): string[] {
  return [...evalResult.expiring_7, ...evalResult.expiring_30];
}
