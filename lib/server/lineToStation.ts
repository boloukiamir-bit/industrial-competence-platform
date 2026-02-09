/**
 * Canonical line → placeholder station row for public.stations.
 * Used by admin Master Data → Lines (POST/PATCH/import). No writes to pl_lines.
 */

/** Derive stable 3-letter area_code from line code (AUTO logic). */
export function lineToAreaCode(lineCode: string): string {
  const raw = lineCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const three = raw.slice(0, 3);
  return three.length >= 3 ? three : three + "X".repeat(3 - three.length);
}

/**
 * True if this station row is an admin placeholder (code LIKE 'LINE-%').
 * Exclude these from operational views (gaps, cockpit, line overview, demand, assignments).
 */
export function isPlaceholderStation(row: { code?: string | null }): boolean {
  return row.code != null && row.code.startsWith("LINE-");
}

/** Sanitize line for use in station code (LINE-<sanitized>). */
export function lineToStationCode(lineCode: string): string {
  const sanitized = lineCode
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 32) || "LINE";
  return `LINE-${sanitized}`;
}

export interface LineStationPayload {
  org_id: string;
  name: string;
  code: string;
  line: string;
  area_code: string;
  is_active: boolean;
  updated_at: string;
}

/** Build payload for upserting a line as a single placeholder station row. */
export function lineToStationPayload(
  orgId: string,
  lineCode: string,
  lineName: string,
  isActive = true
): LineStationPayload {
  const area_code = lineToAreaCode(lineCode);
  const code = lineToStationCode(lineCode);
  const name = `${lineName || lineCode} (LINE)`;
  return {
    org_id: orgId,
    name,
    code,
    line: lineCode.trim(),
    area_code,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  };
}
