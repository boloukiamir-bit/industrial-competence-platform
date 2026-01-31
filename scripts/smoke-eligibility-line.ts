/**
 * Smoke test for GET /api/eligibility/line?line=Bearbetning
 *
 * Pass criteria:
 *   - stations_required === 23
 *   - employees[] contains employee_number "0001" with eligible: true, stations_passed: 23
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:5000 COOKIE="sb-xxx-auth-token=..." npx tsx scripts/smoke-eligibility-line.ts
 *   npm run smoke:eligibility   # uses BASE_URL + COOKIE from env
 */

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:5000";
const COOKIE = process.env.COOKIE || process.env.AUTH_COOKIE;
const LINE = "Bearbetning";
const EXPECTED_STATIONS_REQUIRED = 23;
const PILOT_EMPLOYEE_NUMBER = "0001";
const EXPECTED_PILOT_ELIGIBLE = true;
const EXPECTED_PILOT_STATIONS_PASSED = 23;

async function main(): Promise<void> {
  if (!COOKIE?.trim()) {
    console.error("Missing COOKIE or AUTH_COOKIE. Set e.g. COOKIE=\"sb-xxx-auth-token=...\"");
    process.exit(1);
  }

  const url = `${BASE_URL.replace(/\/$/, "")}/api/eligibility/line?line=${encodeURIComponent(LINE)}`;
  let res: Response;
  let json: unknown;

  try {
    res = await fetch(url, {
      method: "GET",
      headers: { Cookie: COOKIE.trim() },
    });
    json = await res.json();
  } catch (e) {
    console.error("Fetch failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  if (!res.ok) {
    console.error("API error:", res.status, JSON.stringify(json, null, 2));
    process.exit(1);
  }

  const data = json as {
    line?: string;
    stations_required?: number;
    employees?: Array<{
      employee_id: string;
      employee_number: string;
      name: string;
      stations_passed: number;
      eligible: boolean;
    }>;
  };

  const sr = data.stations_required;
  const employees = data.employees ?? [];
  const pilot = employees.find((e) => e.employee_number === PILOT_EMPLOYEE_NUMBER);

  const checks: string[] = [];
  if (sr !== EXPECTED_STATIONS_REQUIRED) {
    checks.push(`stations_required: expected ${EXPECTED_STATIONS_REQUIRED}, got ${sr}`);
  }
  if (!pilot) {
    checks.push(`employees[] missing employee_number "${PILOT_EMPLOYEE_NUMBER}"`);
  } else {
    if (pilot.eligible !== EXPECTED_PILOT_ELIGIBLE) {
      checks.push(`pilot.eligible: expected ${EXPECTED_PILOT_ELIGIBLE}, got ${pilot.eligible}`);
    }
    if (pilot.stations_passed !== EXPECTED_PILOT_STATIONS_PASSED) {
      checks.push(
        `pilot.stations_passed: expected ${EXPECTED_PILOT_STATIONS_PASSED}, got ${pilot.stations_passed}`
      );
    }
  }

  if (checks.length > 0) {
    console.error("Pass criteria failed:");
    checks.forEach((c) => console.error("  -", c));
    console.error("Response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log("Pass criteria OK: stations_required=23, employee 0001 eligible=true, stations_passed=23");
}

main();
