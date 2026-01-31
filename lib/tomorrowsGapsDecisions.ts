import { createHash } from "crypto";

/** Deterministic UUID for (date, shift, line) for execution_decisions target_id (line_shift). */
export function lineShiftTargetId(date: string, shift: string, line: string): string {
  const key = `tg:${date}:${shift}:${line}`;
  const hash = createHash("sha256").update(key).digest();
  const bytes = Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
