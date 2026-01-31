/**
 * Normalize lines API payload. Accepts both shapes:
 * - Old: { lines: string[] }
 * - New: { lines: Array<{ line_code, line_name?, station_count? }> }
 */
export type LineMeta = {
  lineCode: string;
  lineName: string;
  stationCount?: number;
};

export function normalizeLines(payload: unknown): LineMeta[] {
  const arr = (payload as { lines?: unknown })?.lines ?? [];
  if (!Array.isArray(arr)) return [];
  if (arr.length === 0) return [];
  if (typeof arr[0] === "string") {
    return (arr as string[]).map((s: string) => ({ lineCode: s, lineName: s }));
  }
  return (arr as Record<string, unknown>[])
    .map((o: Record<string, unknown>) => {
      const lineCode = (o.line_code ?? o.lineCode ?? o.id ?? "").toString();
      const lineName = (o.line_name ?? o.lineName ?? lineCode).toString();
      const stationCount = o.station_count ?? o.stationCount;
      return {
        lineCode,
        lineName,
        stationCount: typeof stationCount === "number" ? stationCount : undefined,
      };
    })
    .filter((x) => x.lineCode);
}
