/**
 * Daniel pilot compliance catalog codes by category.
 * Used by rule evaluation to know which codes exist; actual catalog rows come from DB (org-scoped).
 */

export const COMPLIANCE_CATEGORIES = [
  "work_environment",
  "medical_control",
  "medical_training",
  "customer_requirement",
  "sustainability",
] as const;

export const WORK_ENVIRONMENT_CODES = [
  "BAM_GRUND",
  "BAM_FORTS",
  "FIRE_SAFETY",
  "FIRST_AID",
  "CPR",
] as const;

export const MEDICAL_CONTROL_CODES = [
  "NIGHT_EXAM",
  "EPOXY_EXAM",
  "HAND_INTENSIVE_EXAM",
  "HEARING_TEST",
  "VISION_TEST",
  "GENERAL_HEALTH",
] as const;

export const MEDICAL_TRAINING_CODES = ["EPOXY_TRAINING"] as const;

export const CUSTOMER_REQUIREMENT_CODES = [
  "IKEA_IWAY",
  "IKEA_BUSINESS_ETHICS",
] as const;

export const SUSTAINABILITY_CODES = ["FSC"] as const;

export const ALL_DANIEL_PILOT_CODES: string[] = [
  ...WORK_ENVIRONMENT_CODES,
  ...MEDICAL_CONTROL_CODES,
  ...MEDICAL_TRAINING_CODES,
  ...CUSTOMER_REQUIREMENT_CODES,
  ...SUSTAINABILITY_CODES,
];
