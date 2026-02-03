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
    in: () => query,
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
  const employeeSkills = [
    {
      employee_id: "e1",
      skill_id: "s1",
      level: 2,
      skill: { id: "s1", code: "PRESS_A", name: "Press A", category: "Production" },
    },
  ];

  const skillsCatalog = [
    { id: "s1", code: "PRESS_A", name: "Press A", category: "Production" },
  ];
  const eqCalls: Array<[string, string]> = [];
  const skillsQuery = createQuery({ data: skillsCatalog, error: null });
  const employeesQuery = createQuery({ data: employees, error: null }, eqCalls);
  const employeeSkillsQuery = createQuery({ data: employeeSkills, error: null });

  const skillsChain = {
    select: () => ({ eq: () => ({ order: () => ({ order: () => skillsQuery }) }) }),
  };
  // employeesBaseQuery does from("employees").select("*").eq("org_id",...).eq("is_active",...); service then .select("*")
  const employeesAfterEq = {
    select: () => ({ ...employeesQuery, eq: () => ({ eq: () => employeesQuery }) }),
    ...employeesQuery,
  };
  const employeesChain = {
    select: () => ({
      eq: (col: string, val: string) => {
        eqCalls.push([col, val]);
        return {
          eq: (c2: string, v2: string) => {
            eqCalls.push([c2, v2]);
            return employeesAfterEq;
          },
        };
      },
    }),
  };

  const originalFrom = (supabase as { from: unknown }).from;
  (supabase as { from: unknown }).from = (table: string) => {
    if (table === "skills") return skillsChain;
    if (table === "employees") return employeesChain;
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

test("competenceService.getEmployeesWithSkills returns empty skills when no employee_skills", async () => {
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
  const employeeSkills: Array<{ employee_id: string; skill_id: string; level: number }> = [];

  const skillsQuery = createQuery({ data: [], error: null });
  const employeesQuery = createQuery({ data: employees, error: null });
  const employeeSkillsQuery = createQuery({ data: employeeSkills, error: null });

  const skillsChain = {
    select: () => ({ eq: () => ({ order: () => ({ order: () => skillsQuery }) }) }),
  };
  const employeesAfterEq = {
    select: () => ({ ...employeesQuery, eq: () => ({ eq: () => employeesQuery }) }),
    ...employeesQuery,
  };
  const employeesChain = {
    select: () => ({ eq: () => ({ eq: () => employeesAfterEq }) }),
  };

  const originalFrom = (supabase as { from: unknown }).from;
  (supabase as { from: unknown }).from = (table: string) => {
    if (table === "skills") return skillsChain;
    if (table === "employees") return employeesChain;
    if (table === "employee_skills") return { select: () => employeeSkillsQuery };
    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const result = await getEmployeesWithSkills({ orgId: "org-1" });
    assert.equal(result.employeeSkills.length, 0);
    assert.equal(result.skills.length, 0);
  } finally {
    (supabase as { from: unknown }).from = originalFrom;
  }
});
