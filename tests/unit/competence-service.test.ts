import test from "node:test";
import assert from "node:assert/strict";
import { getEmployeesWithSkills } from "@/services/competenceService";
import { supabase } from "@/lib/supabaseClient";

type QueryResult = { data: any[] | null; error: null | { message: string } };

function createQuery(result: QueryResult, eqCalls: Array<[string, string]> = []) {
  const query = {
    eq: (column: string, value: string) => {
      eqCalls.push([column, value]);
      return query;
    },
    then: (resolve: (value: QueryResult) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
    catch: (reject: (reason?: unknown) => void) => Promise.resolve(result).catch(reject),
  };
  return query;
}

test("competenceService.getEmployeesWithSkills returns only referenced skills", async () => {
  const employees = [
    {
      id: "e1",
      name: "Alice",
      employee_number: "E1",
      role: "Operator",
      line: "Line 1",
      team: "Day",
      employment_type: "permanent",
      is_active: true,
    },
  ];
  const skills = [
    { id: "s1", code: "PRESS_A", name: "Press A", category: "Production", description: null },
    { id: "s2", code: "TRUCK_A1", name: "Truck A1", category: "Logistics", description: null },
  ];
  const employeeSkills = [{ employee_id: "e1", skill_id: "s1", level: 2 }];

  const eqCalls: Array<[string, string]> = [];
  const employeesQuery = createQuery({ data: employees, error: null }, eqCalls);
  const skillsQuery = createQuery({ data: skills, error: null });
  const employeeSkillsQuery = createQuery({ data: employeeSkills, error: null });

  const originalFrom = (supabase as { from: unknown }).from;
  (supabase as { from: unknown }).from = (table: string) => {
    if (table === "employees") return { select: () => employeesQuery };
    if (table === "skills") return { select: () => skillsQuery };
    if (table === "employee_skills") return { select: () => employeeSkillsQuery };
    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const result = await getEmployeesWithSkills({ orgId: "org-1" });
    assert.ok(eqCalls.some(([column, value]) => column === "org_id" && value === "org-1"));
    assert.deepEqual(result.skills.map((s) => s.code), ["PRESS_A"]);
    assert.equal(result.employeeSkills.length, 1);
  } finally {
    (supabase as { from: unknown }).from = originalFrom;
  }
});
