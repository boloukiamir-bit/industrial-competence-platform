/**
 * Deterministic SHA-256 hash of readiness snapshot canonical payload.
 * Single source of truth for hashing: app (Node) only. DB stores the hash; it does not compute it.
 * Algorithm versioning: V1 = pre-chain (no previous_hash/chain_position), V2 = chain-aware.
 * Shared by freeze (on insert) and verify endpoint. Inserts use V2 canonical only.
 */
import { createHash } from "node:crypto";

/** Legacy: canonical payload WITHOUT previous_hash or chain_position. */
export const HASH_ALGO_V1 = "SHA256_V1" as const;
/** Chain-aware: canonical payload WITH previous_hash and chain_position. */
export const HASH_ALGO_V2 = "SHA256_V2" as const;

/** @deprecated Use HASH_ALGO_V2 for new snapshots; HASH_ALGO_V1 for verify of legacy rows. */
export const PAYLOAD_HASH_ALGO = HASH_ALGO_V1;

export type CanonicalPayloadInput = {
  org_id: string;
  site_id: string;
  shift_date: string;
  shift_code: string;
  /** Chain: hash of previous snapshot (null if first or prior had no hash). V2 only. */
  previous_hash: string | null;
  /** Chain: 1-based position per org. V2 only. */
  chain_position: number | null;
  legal_flag: string;
  ops_flag: string;
  overall_status: string;
  overall_reason_codes: string[];
  iri_score: number;
  iri_grade: string;
  roster_employee_count: number;
  version: string;
  engines: Record<string, unknown>;
  legal_blockers_sample: unknown[];
  ops_no_go_stations_sample: unknown[];
};

function sortedReasonCodes(input: CanonicalPayloadInput): string[] {
  return [...input.overall_reason_codes].sort();
}

function sortedEngines(input: CanonicalPayloadInput): Record<string, unknown> {
  return input.engines && typeof input.engines === "object"
    ? Object.fromEntries(
        Object.entries(input.engines).sort(([a], [b]) => a.localeCompare(b))
      )
    : {};
}

/**
 * V1 canonical: must NOT include previous_hash or chain_position (legacy, pre-chain).
 */
export function buildCanonicalPayloadV1(input: CanonicalPayloadInput): string {
  const canonical = {
    org_id: input.org_id,
    site_id: input.site_id,
    shift_date: input.shift_date,
    shift_code: input.shift_code,
    legal_flag: input.legal_flag,
    ops_flag: input.ops_flag,
    overall_status: input.overall_status,
    overall_reason_codes: sortedReasonCodes(input),
    iri_score: input.iri_score,
    iri_grade: input.iri_grade,
    roster_employee_count: input.roster_employee_count,
    version: input.version,
    engines: sortedEngines(input),
    legal_blockers_sample: input.legal_blockers_sample,
    ops_no_go_stations_sample: input.ops_no_go_stations_sample,
  };
  return JSON.stringify(canonical);
}

/**
 * V2 canonical: must include previous_hash and chain_position (fixed position: after shift_code, before legal_flag).
 */
export function buildCanonicalPayloadV2(input: CanonicalPayloadInput): string {
  const canonical = {
    org_id: input.org_id,
    site_id: input.site_id,
    shift_date: input.shift_date,
    shift_code: input.shift_code,
    previous_hash: input.previous_hash,
    chain_position: input.chain_position,
    legal_flag: input.legal_flag,
    ops_flag: input.ops_flag,
    overall_status: input.overall_status,
    overall_reason_codes: sortedReasonCodes(input),
    iri_score: input.iri_score,
    iri_grade: input.iri_grade,
    roster_employee_count: input.roster_employee_count,
    version: input.version,
    engines: sortedEngines(input),
    legal_blockers_sample: input.legal_blockers_sample,
    ops_no_go_stations_sample: input.ops_no_go_stations_sample,
  };
  return JSON.stringify(canonical);
}

/**
 * Compute SHA-256 hex digest of canonical payload (UTF-8).
 * @param algo - HASH_ALGO_V1 (legacy) or HASH_ALGO_V2 (chain-aware)
 */
export function computePayloadHash(
  input: CanonicalPayloadInput,
  algo: string
): string {
  const json =
    algo === HASH_ALGO_V2
      ? buildCanonicalPayloadV2(input)
      : algo === HASH_ALGO_V1
        ? buildCanonicalPayloadV1(input)
        : (() => {
            throw new Error(`Unsupported payload_hash_algo: ${algo}`);
          })();
  return createHash("sha256").update(json, "utf8").digest("hex");
}

/**
 * Normalize shift_date to YYYY-MM-DD for canonical hash (DB may return date or string).
 */
function normalizeShiftDate(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (typeof v === "string") return v.slice(0, 10);
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  return "";
}

/**
 * Build CanonicalPayloadInput from a readiness_snapshots row (for verify).
 * Extracts all fields; for V1 verify the builder ignores chain fields.
 */
export function canonicalPayloadFromRow(row: Record<string, unknown>): CanonicalPayloadInput {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const obj = (v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
  const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

  const prevHash = row.previous_hash;
  const chainPos = row.chain_position;
  const chainPosition =
    chainPos != null
      ? (typeof chainPos === "number"
          ? (Number.isFinite(chainPos) ? chainPos : null)
          : (() => {
              const n = parseInt(String(chainPos), 10);
              return Number.isFinite(n) ? n : null;
            })())
      : null;

  return {
    org_id: str(row.org_id, ""),
    site_id: str(row.site_id, ""),
    shift_date: normalizeShiftDate(row.shift_date),
    shift_code: str(row.shift_code, ""),
    previous_hash: prevHash == null ? null : str(prevHash, ""),
    chain_position: chainPosition,
    legal_flag: str(row.legal_flag, "LEGAL_GO"),
    ops_flag: str(row.ops_flag, "OPS_GO"),
    overall_status: str(row.overall_status, "GO"),
    overall_reason_codes: arr(row.overall_reason_codes).filter((c): c is string => typeof c === "string"),
    iri_score: num(row.iri_score, 0),
    iri_grade: str(row.iri_grade, "F"),
    roster_employee_count: num(row.roster_employee_count, 0),
    version: str(row.version, "IRI_V1"),
    engines: obj(row.engines),
    legal_blockers_sample: arr(row.legal_blockers_sample),
    ops_no_go_stations_sample: arr(row.ops_no_go_stations_sample),
  };
}
