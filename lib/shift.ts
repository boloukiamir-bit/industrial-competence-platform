/**
 * Single source of truth for shift parsing and normalization.
 * Re-exports from lib/shiftType.ts for backward compatibility.
 * 
 * Use normalizeShift() in all API routes and services.
 */

export {
  normalizeShift,
  normalizeShiftType,
  normalizeShiftTypeOrDefault,
  parseShiftQueryParam,
  toQueryShiftType,
  type CanonicalShiftType,
  type QueryShiftType,
} from "./shiftType";
