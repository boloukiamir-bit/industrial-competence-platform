/**
 * Normalize lines API payload so consumers accept both shapes:
 * - Old: { lines: string[] }
 * - New: { lines: Array<{ line_code, line_name?, station_count? }> }
 */
export type NormalizedLine = {
  lineCode: string;
  lineName: string;
  stationCount?: number;
};

type LinePayloadItem =
  | string
  | {
      line_code?: string;
      line_name?: string;
      lineCode?: string;
      lineName?: string;
      id?: string;
      station_count?: number;
      stationCount?: number;
    };

type LinesPayload = {
  lines?: LinePayloadItem[] | unknown;
};

export function normalizeLines(payload: unknown): NormalizedLine[] {
  if (payload == null || typeof payload !== "object") return [];
  const p = payload as LinesPayload;
  const raw = p.lines;
  if (!Array.isArray(raw)) return [];
  return raw.map((item): NormalizedLine => {
    if (typeof item === "string") {
      return { lineCode: item, lineName: item };
    }
    if (item == null || typeof item !== "object") {
      return { lineCode: "", lineName: "" };
    }
    const o = item as {
      line_code?: string;
      line_name?: string;
      lineCode?: string;
      lineName?: string;
      id?: string;
      station_count?: number;
      stationCount?: number;
    };
    const lineCode =
      o.line_code ?? o.lineCode ?? o.id ?? "";
    const lineName =
      o.line_name ?? o.lineName ?? lineCode;
    const stationCount = o.station_count ?? o.stationCount;
    return {
      lineCode: String(lineCode),
      lineName: String(lineName),
      ...(typeof stationCount === "number" ? { stationCount } : {}),
    };
  }).filter((n) => n.lineCode !== "");
}
