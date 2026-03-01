/**
 * Shared ledger chain verification: hash + chain linkage over ordered snapshot rows.
 * Used by GET /api/readiness/ledger/verify and GET /api/readiness/ledger/attest.
 */
import {
  computePayloadHash,
  canonicalPayloadFromRow,
  HASH_ALGO_V1,
  HASH_ALGO_V2,
} from "@/lib/server/readiness/snapshotPayloadHash";

export type SnapshotRow = Record<string, unknown>;

export type VerifyLedgerResult =
  | { chain_valid: true }
  | { chain_valid: false; reason: string; first_invalid_position?: number };

/**
 * Verify ordered list of readiness_snapshots rows (chain_position ASC NULLS LAST, created_at ASC).
 * Step A: each row's payload_hash must be non-null and match recomputed hash.
 * Step B: for V2 rows, chain linkage (position 1 → previous_hash null; position > 1 → previous_hash === previous row's payload_hash).
 */
export function verifyLedgerChain(rows: SnapshotRow[]): VerifyLedgerResult {
  if (rows.length === 0) {
    return { chain_valid: true };
  }

  let lastRow: SnapshotRow | null = null;

  for (const row of rows) {
    const chainPosition =
      row.chain_position != null
        ? typeof row.chain_position === "number"
          ? row.chain_position
          : parseInt(String(row.chain_position), 10)
        : null;
    const payloadHash = row.payload_hash == null ? null : String(row.payload_hash).trim();

    // Step A — Hash validation
    if (payloadHash == null || payloadHash === "") {
      return {
        chain_valid: false,
        reason: "MISSING_HASH",
        first_invalid_position: chainPosition ?? undefined,
      };
    }

    const algo =
      (row.payload_hash_algo != null ? String(row.payload_hash_algo).trim() : null) ?? HASH_ALGO_V1;
    const input = canonicalPayloadFromRow(row);
    const computedHash = computePayloadHash(input, algo);

    if (computedHash !== payloadHash) {
      return {
        chain_valid: false,
        reason: "HASH_MISMATCH",
        first_invalid_position: chainPosition ?? undefined,
      };
    }

    // Step B — Chain linkage validation (V2 only)
    if (algo === HASH_ALGO_V2) {
      if (chainPosition === 1) {
        const prevHash = row.previous_hash;
        if (prevHash != null && String(prevHash).trim() !== "") {
          return {
            chain_valid: false,
            reason: "CHAIN_BROKEN_AT_GENESIS",
            first_invalid_position: 1,
          };
        }
      } else if (chainPosition != null && chainPosition > 1) {
        const expectedPrev = lastRow
          ? lastRow.payload_hash == null
            ? null
            : String(lastRow.payload_hash).trim()
          : null;
        const actualPrev = row.previous_hash == null ? null : String(row.previous_hash).trim();
        if (actualPrev !== expectedPrev) {
          return {
            chain_valid: false,
            reason: "CHAIN_LINK_MISMATCH",
            first_invalid_position: chainPosition,
          };
        }
      }
    }

    lastRow = row;
  }

  return { chain_valid: true };
}
