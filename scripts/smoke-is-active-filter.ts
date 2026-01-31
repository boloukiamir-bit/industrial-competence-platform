/**
 * Dev-only smoke test: inactive employees (is_active=false) must never appear in
 * GET /api/line-overview or POST /api/line-overview/suggestions.
 *
 * 1. Creates a fake demo employee with is_active=false.
 * 2. Calls line-overview and suggestions; asserts the employee never appears.
 * 3. Deletes the test employee.
 *
 * Usage:
 *   ORG_ID=<uuid> BASE_URL=http://127.0.0.1:5000 COOKIE="sb-xxx=..." \
 *   npx tsx scripts/smoke-is-active-filter.ts
 *
 * Requires: ORG_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BASE_URL, COOKIE
 */
import { createClient } from "@supabase/supabase-js";

const ORG_ID = process.env.ORG_ID;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const COOKIE = process.env.COOKIE || process.env.AUTH_COOKIE;

const TEST_EMPLOYEE_NUMBER = "IS_ACTIVE_FILTER_TEST";
const TEST_NAME = "Inactive Filter Test";

async function main(): Promise<void> {
  if (!ORG_ID || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !COOKIE?.trim()) {
    console.error(
      "Missing env: ORG_ID, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COOKIE (or AUTH_COOKIE)"
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = tomorrow.toISOString().slice(0, 10);

  let testEmployeeId: string | null = null;

  try {
    const { data: inserted, error: insertError } = await supabase
      .from("employees")
      .insert({
        org_id: ORG_ID,
        employee_number: TEST_EMPLOYEE_NUMBER,
        name: TEST_NAME,
        is_active: false,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create test employee:", insertError.message);
      process.exit(1);
    }
    testEmployeeId = inserted?.id ?? null;
    if (!testEmployeeId) {
      console.error("No id returned from insert");
      process.exit(1);
    }

    const lineOverviewRes = await fetch(
      `${BASE_URL}/api/line-overview?date=${date}&shift=day`,
      { headers: { Cookie: COOKIE.trim() } }
    );
    if (!lineOverviewRes.ok) {
      console.error("line-overview failed:", lineOverviewRes.status, await lineOverviewRes.text());
      process.exit(1);
    }
    const lineOverviewJson = (await lineOverviewRes.json()) as {
      employees?: Array<{ employeeCode?: string }>;
    };
    const employees = lineOverviewJson.employees ?? [];
    const foundInOverview = employees.some((e) => e.employeeCode === TEST_EMPLOYEE_NUMBER);
    if (foundInOverview) {
      console.error("FAIL: Inactive employee appeared in GET /api/line-overview employees list");
      process.exit(1);
    }

    const machines =
      (lineOverviewJson as { lines?: Array<{ machines?: Array<{ machineCode?: string }> }> }).lines
        ?.flatMap((l) => l.machines ?? [])
        .map((m) => m.machineCode)
        .filter(Boolean) ?? [];
    const machineCode = machines[0] ?? "M1";

    const suggestionsRes = await fetch(`${BASE_URL}/api/line-overview/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: COOKIE.trim() },
      body: JSON.stringify({
        machineCode,
        date,
        shift: "day",
        hoursNeeded: 1,
      }),
    });
    if (!suggestionsRes.ok) {
      console.error("suggestions failed:", suggestionsRes.status, await suggestionsRes.text());
      process.exit(1);
    }
    const suggestionsJson = (await suggestionsRes.json()) as {
      suggestions?: Array<{ employee?: { employee_number?: string } }>;
    };
    const suggestions = suggestionsJson.suggestions ?? [];
    const foundInSuggestions = suggestions.some(
      (s) => s.employee?.employee_number === TEST_EMPLOYEE_NUMBER
    );
    if (foundInSuggestions) {
      console.error("FAIL: Inactive employee appeared in POST /api/line-overview/suggestions");
      process.exit(1);
    }

    console.log("OK: Inactive employee never appeared in line-overview or suggestions");
  } finally {
    if (testEmployeeId) {
      await supabase.from("employees").delete().eq("id", testEmployeeId);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
