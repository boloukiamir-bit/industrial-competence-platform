/**
 * Unit tests for inductionService: listCheckpoints, getEmployeeInduction, getInductionStatusForLegitimacy.
 * Uses mocked Supabase admin (no DB). Recompute logic: required vs completed counts and CLEARED when all done.
 */
import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listCheckpoints,
  getEmployeeInduction,
  getInductionStatusForLegitimacy,
} from "@/lib/server/induction/inductionService";

const ORG_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SITE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const EMPLOYEE_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const CP1_ID = "d1111111-1111-1111-1111-111111111111";
const CP2_ID = "d2222222-2222-2222-2222-222222222222";

function mockAdmin(options: {
  checkpoints?: Array<{ id: string; code: string; name: string; site_id: string | null; sort_order: number; is_active: boolean }>;
  employee_induction?: { status: string } | null;
  completions?: Array<{ checkpoint_id: string }>;
}): SupabaseClient {
  const { checkpoints = [], employee_induction = null, completions = [] } = options;
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      or: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: table === "employee_induction" ? employee_induction : null,
          error: null,
        }),
      then: (resolve: (v: { data: unknown; error: null }) => void) => {
        if (table === "induction_checkpoints") return Promise.resolve({ data: checkpoints, error: null }).then(resolve);
        if (table === "employee_induction_completions") return Promise.resolve({ data: completions, error: null }).then(resolve);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
      catch: (fn: (e: unknown) => void) => Promise.resolve({ data: null, error: null }).catch(fn),
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

test("listCheckpoints returns org-wide and site checkpoints", async () => {
  const admin = mockAdmin({
    checkpoints: [
      { id: CP1_ID, code: "DAY1", name: "Day 1", site_id: null, sort_order: 0, is_active: true },
      { id: CP2_ID, code: "WEEK1", name: "Week 1", site_id: SITE_ID, sort_order: 1, is_active: true },
    ],
  });
  const list = await listCheckpoints(admin, { orgId: ORG_ID, siteId: SITE_ID });
  assert.equal(list.length, 2);
  assert.equal(list[0].code, "DAY1");
  assert.equal(list[1].code, "WEEK1");
});

test("getEmployeeInduction not enrolled returns CLEARED and zero counts", async () => {
  const admin = mockAdmin({ employee_induction: null });
  const result = await getEmployeeInduction(admin, { orgId: ORG_ID, siteId: SITE_ID, employeeId: EMPLOYEE_ID });
  assert.equal(result.enrolled, false);
  assert.equal(result.status, "CLEARED");
  assert.equal(result.required_count, 0);
  assert.equal(result.completed_count, 0);
  assert.deepEqual(result.remaining, []);
});

test("getEmployeeInduction null siteId returns not enrolled CLEARED", async () => {
  const admin = mockAdmin({ employee_induction: { status: "RESTRICTED" } });
  const result = await getEmployeeInduction(admin, { orgId: ORG_ID, siteId: null, employeeId: EMPLOYEE_ID });
  assert.equal(result.enrolled, false);
  assert.equal(result.status, "CLEARED");
});

test("getEmployeeInduction enrolled with required and completions returns remaining codes", async () => {
  const admin = mockAdmin({
    checkpoints: [
      { id: CP1_ID, code: "DAY1", name: "Day 1", site_id: null, sort_order: 0, is_active: true },
      { id: CP2_ID, code: "WEEK1", name: "Week 1", site_id: SITE_ID, sort_order: 1, is_active: true },
    ],
    employee_induction: { status: "RESTRICTED" },
    completions: [{ checkpoint_id: CP1_ID }],
  });
  const result = await getEmployeeInduction(admin, { orgId: ORG_ID, siteId: SITE_ID, employeeId: EMPLOYEE_ID });
  assert.equal(result.enrolled, true);
  assert.equal(result.status, "RESTRICTED");
  assert.equal(result.required_count, 2);
  assert.equal(result.completed_count, 1);
  assert.deepEqual(result.remaining, ["WEEK1"]);
});

test("getInductionStatusForLegitimacy no row returns CLEARED", async () => {
  const admin = mockAdmin({ employee_induction: null });
  const status = await getInductionStatusForLegitimacy(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    employeeId: EMPLOYEE_ID,
  });
  assert.equal(status, "CLEARED");
});

test("getInductionStatusForLegitimacy null siteId returns CLEARED", async () => {
  const admin = mockAdmin({ employee_induction: { status: "RESTRICTED" } });
  const status = await getInductionStatusForLegitimacy(admin, {
    orgId: ORG_ID,
    siteId: null,
    employeeId: EMPLOYEE_ID,
  });
  assert.equal(status, "CLEARED");
});

test("getInductionStatusForLegitimacy row RESTRICTED returns RESTRICTED", async () => {
  const admin = mockAdmin({ employee_induction: { status: "RESTRICTED" } });
  const status = await getInductionStatusForLegitimacy(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    employeeId: EMPLOYEE_ID,
  });
  assert.equal(status, "RESTRICTED");
});

test("getInductionStatusForLegitimacy row CLEARED returns CLEARED", async () => {
  const admin = mockAdmin({ employee_induction: { status: "CLEARED" } });
  const status = await getInductionStatusForLegitimacy(admin, {
    orgId: ORG_ID,
    siteId: SITE_ID,
    employeeId: EMPLOYEE_ID,
  });
  assert.equal(status, "CLEARED");
});
