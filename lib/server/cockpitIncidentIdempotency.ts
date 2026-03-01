/**
 * Shared idempotency key for cockpit incident decisions.
 * Must match POST /api/cockpit/decisions/incident and issues enrichment.
 */
export type IssuePayload = {
  type?: string;
  issue_type?: string;
  station_id?: string;
  station_code?: string;
  employee_id?: string;
  employee_name?: string;
  reason_code?: string;
  [k: string]: unknown;
};

export function buildIdempotencyKey(
  date: string,
  shiftCode: string,
  issue: IssuePayload
): string {
  const type = (issue.type ?? issue.issue_type ?? "UNKNOWN").toString().trim();
  const station = (issue.station_id ?? issue.station_code ?? "NA").toString().trim();
  const employee = (issue.employee_id ?? issue.employee_name ?? "NA").toString().trim();
  const reasonCode = (issue.reason_code ?? "NA").toString().trim();
  return `INCIDENT_DECISION:${date}:${shiftCode}:${type}:${station}:${employee}:${reasonCode}`;
}
