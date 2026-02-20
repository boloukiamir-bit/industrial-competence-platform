/**
 * Unit tests for getShiftLegitimacyDrilldown.
 * Uses mocked Supabase admin (no DB). Covers: no employees → GO; WARNING; RESTRICTED; ILLEGAL; mixed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getShiftLegitimacyDrilldown } from "@/lib/server/legitimacy/getShiftLegitimacyDrilldown";

const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SITE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SHIFT_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const E1 = "e1111111-1111-1111-1111-111111111111";
const E2 = "e2222222-2222-2222-2222-222222222222";
const CAT_ID = "cat11111-1111-1111-1111-111111111111";

function addDays(d: Date, days: number): string {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out.toISOString().slice(0, 10);
}

function mockAdmin(config: {
  shift_assignments: Array<{ employee_id: string }>;
  employees: Array<{ id: string; name?: string | null; first_name?: string | null; last_name?: string | null; site_id?: string | null; line_code?: string | null }>;
  catalog: Array<{ id: string; code: string; name: string; default_warning_window_days: number | null }>;
  bindings: Array<{ compliance_code: string; warning_window_days_override: number | null }>;
  employeeComplianceByEmployee: Record<string, Array<{ compliance_id: string; valid_to: string | null; waived: boolean }>>;
  inductionByEmployeeId: Record<string, "RESTRICTED" | "CLEARED">;
  referenceDate: Date;
}): SupabaseClient {
  const chain = (table: string) => {
    const state: { _table: string; _eq: Record<string, unknown>; _in?: { key: string; values: unknown[] }; _or?: string } = {
      _table: table,
      _eq: {},
      _in: undefined,
      _or: undefined,
    };
    const c = {
      select: () => c,
      eq: (k: string, v: unknown) => {
        state._eq[k] = v;
        return c;
      },
      in: (k: string, v: unknown[]) => {
        state._in = { key: k, values: v };
        return c;
      },
      or: (_o: string) => c,
      order: () => c,
      maybeSingle: () => {
        const data = resolve(config, state);
        return Promise.resolve({ data, error: null });
      },
      then: (onFulfilled?: (v: { data: unknown; error: null }) => unknown, onRejected?: (err: unknown) => unknown) => {
        const data = resolve(config, state);
        return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
      },
    };
    return c;
  };
  const from = (table: string) => chain(table);
  return { from } as unknown as SupabaseClient;
}

function resolve(
  config: {
    shift_assignments: Array<{ employee_id: string }>;
    employees: Array<{ id: string; name?: string | null; first_name?: string | null; last_name?: string | null; site_id?: string | null; line_code?: string | null }>;
    catalog: Array<{ id: string; code: string; name: string; default_warning_window_days: number | null }>;
    bindings: Array<{ compliance_code: string; warning_window_days_override: number | null }>;
    employeeComplianceByEmployee: Record<string, Array<{ compliance_id: string; valid_to: string | null; waived: boolean }>>;
    inductionByEmployeeId: Record<string, "RESTRICTED" | "CLEARED">;
  },
  state: { _table: string; _eq: Record<string, unknown>; _in?: { key: string; values: unknown[] } }
): unknown {
  const t = state._table;
  if (t === "shift_assignments") return config.shift_assignments;
  if (t === "employees") {
    if (state._in?.key === "id") {
      const ids = state._in.values as string[];
      return config.employees.filter((e) => ids.includes(e.id));
    }
    const id = state._eq.id as string | undefined;
    if (id != null) return config.employees.find((e) => e.id === id) ?? null;
    return null;
  }
  if (t === "compliance_catalog") return config.catalog;
  if (t === "compliance_requirement_bindings") return config.bindings;
  if (t === "employee_roles") return [];
  if (t === "employee_compliance") {
    const employeeId = state._eq.employee_id as string | undefined;
    return employeeId != null ? (config.employeeComplianceByEmployee[employeeId] ?? []) : [];
  }
  if (t === "employee_induction") {
    const employeeId = state._eq.employee_id as string | undefined;
    if (employeeId == null) return null;
    return config.inductionByEmployeeId[employeeId] === "RESTRICTED" ? { status: "RESTRICTED" } : null;
  }
  return null;
}

test("getShiftLegitimacyDrilldown - No employees → GO, empty arrays", async () => {
  const ref = new Date("2025-06-01");
  const admin = mockAdmin({
    referenceDate: ref,
    shift_assignments: [],
    employees: [],
    catalog: [],
    bindings: [],
    employeeComplianceByEmployee: {},
    inductionByEmployeeId: {},
  });
  const result = await getShiftLegitimacyDrilldown(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    referenceDate: ref,
  });
  assert.equal(result.shift_status, "GO");
  assert.equal(result.blocking_employees.length, 0);
  assert.equal(result.warning_employees.length, 0);
});

test("getShiftLegitimacyDrilldown - One WARNING employee → WARNING + in warning_employees", async () => {
  const ref = new Date("2025-06-01");
  const validToExpiring = addDays(ref, 14);
  const admin = mockAdmin({
    referenceDate: ref,
    shift_assignments: [{ employee_id: E1 }],
    employees: [{ id: E1, name: "Alice", site_id: null, line_code: null }],
    catalog: [{ id: CAT_ID, code: "SAFE", name: "Safety", default_warning_window_days: 30 }],
    bindings: [{ compliance_code: "SAFE", warning_window_days_override: null }],
    employeeComplianceByEmployee: {
      [E1]: [{ compliance_id: CAT_ID, valid_to: validToExpiring, waived: false }],
    },
    inductionByEmployeeId: { [E1]: "CLEARED" },
  });
  const result = await getShiftLegitimacyDrilldown(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    referenceDate: ref,
  });
  assert.equal(result.shift_status, "WARNING");
  assert.equal(result.blocking_employees.length, 0);
  assert.equal(result.warning_employees.length, 1);
  assert.equal(result.warning_employees[0].id, E1);
  assert.equal(result.warning_employees[0].name, "Alice");
  assert.ok(result.warning_employees[0].reasons.includes("COMPLIANCE_EXPIRING"));
});

test("getShiftLegitimacyDrilldown - One RESTRICTED → ILLEGAL + in blocking_employees", async () => {
  const ref = new Date("2025-06-01");
  const admin = mockAdmin({
    referenceDate: ref,
    shift_assignments: [{ employee_id: E1 }],
    employees: [{ id: E1, name: "Bob", site_id: null, line_code: null }],
    catalog: [{ id: CAT_ID, code: "SAFE", name: "Safety", default_warning_window_days: 30 }],
    bindings: [{ compliance_code: "SAFE", warning_window_days_override: null }],
    employeeComplianceByEmployee: { [E1]: [] },
    inductionByEmployeeId: { [E1]: "RESTRICTED" },
  });
  const result = await getShiftLegitimacyDrilldown(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    referenceDate: ref,
  });
  assert.equal(result.shift_status, "ILLEGAL");
  assert.equal(result.blocking_employees.length, 1);
  assert.equal(result.blocking_employees[0].id, E1);
  assert.equal(result.blocking_employees[0].name, "Bob");
  assert.ok(result.blocking_employees[0].reasons.includes("INDUCTION_INCOMPLETE"));
  assert.equal(result.warning_employees.length, 0);
});

test("getShiftLegitimacyDrilldown - One ILLEGAL (expired compliance) → ILLEGAL", async () => {
  const ref = new Date("2025-06-01");
  const admin = mockAdmin({
    referenceDate: ref,
    shift_assignments: [{ employee_id: E1 }],
    employees: [{ id: E1, name: "Carol", site_id: null, line_code: null }],
    catalog: [{ id: CAT_ID, code: "SAFE", name: "Safety", default_warning_window_days: 30 }],
    bindings: [{ compliance_code: "SAFE", warning_window_days_override: null }],
    employeeComplianceByEmployee: {
      [E1]: [{ compliance_id: CAT_ID, valid_to: "2020-01-01", waived: false }],
    },
    inductionByEmployeeId: { [E1]: "CLEARED" },
  });
  const result = await getShiftLegitimacyDrilldown(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    referenceDate: ref,
  });
  assert.equal(result.shift_status, "ILLEGAL");
  assert.equal(result.blocking_employees.length, 1);
  assert.equal(result.blocking_employees[0].id, E1);
  assert.ok(result.blocking_employees[0].reasons.includes("COMPLIANCE_EXPIRED"));
  assert.equal(result.warning_employees.length, 0);
});

test("getShiftLegitimacyDrilldown - Mixed ILLEGAL + WARNING → ILLEGAL, both in correct arrays", async () => {
  const ref = new Date("2025-06-01");
  const validToExpiring = addDays(ref, 14);
  const admin = mockAdmin({
    referenceDate: ref,
    shift_assignments: [{ employee_id: E1 }, { employee_id: E2 }],
    employees: [
      { id: E1, name: "Illegal Alice", site_id: null, line_code: null },
      { id: E2, name: "Warning Bob", site_id: null, line_code: null },
    ],
    catalog: [{ id: CAT_ID, code: "SAFE", name: "Safety", default_warning_window_days: 30 }],
    bindings: [{ compliance_code: "SAFE", warning_window_days_override: null }],
    employeeComplianceByEmployee: {
      [E1]: [{ compliance_id: CAT_ID, valid_to: "2020-01-01", waived: false }],
      [E2]: [{ compliance_id: CAT_ID, valid_to: validToExpiring, waived: false }],
    },
    inductionByEmployeeId: { [E1]: "CLEARED", [E2]: "CLEARED" },
  });
  const result = await getShiftLegitimacyDrilldown(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    shiftId: SHIFT_ID,
    referenceDate: ref,
  });
  assert.equal(result.shift_status, "ILLEGAL");
  assert.equal(result.blocking_employees.length, 1);
  assert.equal(result.blocking_employees[0].id, E1);
  assert.ok(result.blocking_employees[0].reasons.includes("COMPLIANCE_EXPIRED"));
  assert.equal(result.warning_employees.length, 1);
  assert.equal(result.warning_employees[0].id, E2);
  assert.ok(result.warning_employees[0].reasons.includes("COMPLIANCE_EXPIRING"));
});
