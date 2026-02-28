/**
 * Industrial Readiness Index™ v1 (IRI_V1).
 * Deterministic score and grade from readiness-v3 legal + ops outputs.
 */

export type LegalFlag = "LEGAL_GO" | "LEGAL_WARNING" | "LEGAL_NO_GO";
export type OpsFlag = "OPS_GO" | "OPS_WARNING" | "OPS_NO_GO";
export type IriGrade = "A" | "B" | "C" | "D" | "E" | "F";

export type LegalKpis = {
  blocking_count?: number;
  non_blocking_count?: number;
  [key: string]: number | undefined;
};

export type OpsKpis = {
  stations_no_go?: number;
  stations_warning?: number;
  [key: string]: number | undefined;
};

export type IriDeduction = {
  type: "LEGAL_BLOCKING" | "LEGAL_WARNING" | "OPS_NO_GO" | "OPS_WARNING";
  count: number;
  impact_per_unit: number;
  total_impact: number;
};

export type IriBreakdown = {
  base_score: number;
  deductions: IriDeduction[];
};

export type IriV1Result = {
  score: number;
  grade: IriGrade;
  breakdown: IriBreakdown;
};

const BASE_SCORE = 100;
const IMPACT_LEGAL_BLOCKING = 20;
const IMPACT_LEGAL_WARNING = 5;
const IMPACT_OPS_NO_GO = 15;
const IMPACT_OPS_WARNING = 5;

/**
 * Map numeric score to IRI_V1 grade.
 * >=90 → A, >=75 → B, >=60 → C, >=40 → D, >0 → E, 0 → F
 */
export function scoreToGrade(score: number): IriGrade {
  if (score <= 0) return "F";
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "E";
}

/**
 * Compute IRI_V1 score, grade, and breakdown from readiness-v3 legal/ops flags and kpis.
 * Hard stop: if legal.flag === LEGAL_NO_GO or ops.flag === OPS_NO_GO, score = 0.
 * Else: score = 100 - deductions (20*blocking, 5*non_blocking, 15*stations_no_go, 5*stations_warning), min 0.
 */
export function computeIRIV1(
  legalFlag: LegalFlag,
  legalKpis: LegalKpis,
  opsFlag: OpsFlag,
  opsKpis: OpsKpis
): IriV1Result {
  const blockingCount = Math.max(0, legalKpis.blocking_count ?? 0);
  const nonBlockingCount = Math.max(0, legalKpis.non_blocking_count ?? 0);
  const stationsNoGo = Math.max(0, opsKpis.stations_no_go ?? 0);
  const stationsWarning = Math.max(0, opsKpis.stations_warning ?? 0);

  const deductions: IriDeduction[] = [
    {
      type: "LEGAL_BLOCKING",
      count: blockingCount,
      impact_per_unit: IMPACT_LEGAL_BLOCKING,
      total_impact: blockingCount * IMPACT_LEGAL_BLOCKING,
    },
    {
      type: "LEGAL_WARNING",
      count: nonBlockingCount,
      impact_per_unit: IMPACT_LEGAL_WARNING,
      total_impact: nonBlockingCount * IMPACT_LEGAL_WARNING,
    },
    {
      type: "OPS_NO_GO",
      count: stationsNoGo,
      impact_per_unit: IMPACT_OPS_NO_GO,
      total_impact: stationsNoGo * IMPACT_OPS_NO_GO,
    },
    {
      type: "OPS_WARNING",
      count: stationsWarning,
      impact_per_unit: IMPACT_OPS_WARNING,
      total_impact: stationsWarning * IMPACT_OPS_WARNING,
    },
  ];

  const hardStop = legalFlag === "LEGAL_NO_GO" || opsFlag === "OPS_NO_GO";
  let score: number;
  if (hardStop) {
    score = 0;
  } else {
    score = BASE_SCORE;
    score -= blockingCount * IMPACT_LEGAL_BLOCKING;
    score -= nonBlockingCount * IMPACT_LEGAL_WARNING;
    score -= stationsNoGo * IMPACT_OPS_NO_GO;
    score -= stationsWarning * IMPACT_OPS_WARNING;
    if (score < 0) score = 0;
  }

  return {
    score,
    grade: scoreToGrade(score),
    breakdown: {
      base_score: BASE_SCORE,
      deductions,
    },
  };
}
