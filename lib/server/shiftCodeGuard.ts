type ShiftCodeCheck = {
  shift_code?: string | null;
  shift_type?: string | null;
};

export function warnShiftTypeMismatch(row: ShiftCodeCheck | null | undefined, context: string): void {
  if (!row) return;
  const shiftCode = typeof row.shift_code === "string" ? row.shift_code.trim() : "";
  const shiftType = typeof row.shift_type === "string" ? row.shift_type.trim() : "";
  if (shiftType && shiftCode && shiftType !== shiftCode) {
    console.warn("[shift_code] shift_type mismatch", {
      context,
      shift_code: shiftCode,
      shift_type: shiftType,
    });
  }
}
