/**
 * Unit test for getEligibilityByLine: mandatory-only requirements, line_code for employees.
 * Fixture: 1 station with MANDATORY LEAN_5S, 1 employee in line with employee_skills LEAN_5S level 1.
 * Expect: eligibleOperatorsCount === 1, LEAN_5S not in missing (required_skill_codes present but employee is eligible).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getEligibilityByLine } from "@/services/eligibilityService";
import type { SupabaseClient } from "@supabase/supabase-js";

const ORG_ID = "org-1";
const LINE = "Bearbetning";
const STATION_ID = "st1";
const SKILL_ID = "skill-lean";
const EMP_ID = "emp1";

function mockSupabaseEligibility(): SupabaseClient {
  let callIndex = 0;
  const thenable = (data: unknown, error: null = null) => ({
    then: (resolve: (v: { data: unknown; error: null }) => void) => {
      setTimeout(() => resolve({ data, error }), 0);
      return { catch: () => ({}) };
    },
    catch: () => ({}),
  });

  const chain = (result: unknown) => ({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => thenable(result) }) }) }),
    in: () => thenable(result),
  });
  const chainWithRange = (result: unknown) => ({
    select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ range: () => thenable(result) }) }) }) }),
  });
  const chainInIn = (result: unknown) => ({
    select: () => ({ in: () => ({ in: () => thenable(result) }) }),
  });
  const chainEqIn = (result: unknown) => ({
    select: () => ({ eq: () => ({ in: () => thenable(result) }) }),
  });

  const from = (table: string) => {
    if (table === "stations") {
      return chain([{ id: STATION_ID }]);
    }
    if (table === "station_skill_requirements") {
      return chainEqIn([{ skill_id: SKILL_ID, required_level: 1, is_mandatory: true }]);
    }
    if (table === "skills") {
      return chainEqIn([{ id: SKILL_ID, code: "LEAN_5S", name: "LEAN 5S" }]);
    }
    if (table === "employees") {
      return chainWithRange([{ id: EMP_ID, employee_number: "E1", name: "Alice" }]);
    }
    if (table === "employee_skills") {
      return chainInIn([{ employee_id: EMP_ID, skill_id: SKILL_ID, level: 1 }]);
    }
    throw new Error(`Unexpected table: ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

test("getEligibilityByLine - 1 mandatory LEAN_5S, 1 employee with LEAN_5S => eligibleOperatorsCount 1, LEAN_5S not missing", async () => {
  const supabase = mockSupabaseEligibility();
  const result = await getEligibilityByLine(supabase, ORG_ID, LINE);

  const eligibleCount = result.employees.filter((e) => e.eligible).length;
  assert.equal(eligibleCount, 1, "eligibleOperatorsCount should be 1");
  assert.equal(result.employees.length, 1);
  assert.equal(result.employees[0].eligible, true);
  assert.equal(result.required_skill_codes.includes("LEAN_5S"), true, "LEAN_5S is a required skill");
  assert.equal(result.employees[0].skills_passed_count, 1);
  assert.equal(result.employees[0].required_skills_count, 1);
});

test("getEligibilityByLine - PREFERRED only (is_mandatory false) does not block eligibility", async () => {
  const thenable = (data: unknown) => ({
    then: (resolve: (v: { data: unknown; error: null }) => void) => {
      setTimeout(() => resolve({ data, error: null }), 0);
      return { catch: () => ({}) };
    },
    catch: () => ({}),
  });
  const supabase = {
    from: (table: string) => {
      if (table === "stations") return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => thenable([{ id: "st1" }]) }) }) }) };
      if (table === "station_skill_requirements") {
        return { select: () => ({ eq: () => ({ in: () => thenable([{ skill_id: "s1", required_level: 1, is_mandatory: false }]) }) }) };
      }
      if (table === "skills") return { select: () => ({ eq: () => ({ in: () => thenable([]) }) }) };
      if (table === "employees") return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ range: () => thenable([{ id: "e1", employee_number: "E1", name: "Bob" }]) }) }) }) }) };
      if (table === "employee_skills") return { select: () => ({ in: () => ({ in: () => thenable([]) }) }) };
      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
  const result = await getEligibilityByLine(supabase, ORG_ID, LINE);
  const eligibleCount = result.employees.filter((e) => e.eligible).length;
  assert.equal(eligibleCount, 1, "PREFERRED-only must not block; eligibleOperatorsCount should be 1");
  assert.equal(result.employees[0].eligible, true);
});
