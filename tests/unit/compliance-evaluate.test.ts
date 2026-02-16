import test from "node:test";
import assert from "node:assert/strict";
import { buildStationComplianceDetail } from "@/lib/compliance/evaluate";
import { evaluateEmployeeCompliance } from "@/lib/compliance/rules";

test("buildStationComplianceDetail produces blockers with status and affected_employees", () => {
  const required = ["BAM_GRUND", "FIRE_SAFETY"];
  const codeToName = new Map<string, string>([
    ["BAM_GRUND", "BAM Grund"],
    ["FIRE_SAFETY", "Brandskydd"],
  ]);

  const emp1Records = new Map([
    ["BAM_GRUND", { code: "BAM_GRUND", valid_to: "2030-01-01", waived: false }],
    ["FIRE_SAFETY", { code: "FIRE_SAFETY", valid_to: null, waived: false }],
  ]);
  const emp2Records = new Map([
    ["BAM_GRUND", { code: "BAM_GRUND", valid_to: null, waived: false }],
    ["FIRE_SAFETY", { code: "FIRE_SAFETY", valid_to: "2020-01-01", waived: false }],
  ]);

  const eval1 = evaluateEmployeeCompliance(required, emp1Records);
  const eval2 = evaluateEmployeeCompliance(required, emp2Records);

  const { blockers, warnings } = buildStationComplianceDetail(
    [
      { employeeId: "e1", employeeName: "Alice", evalResult: eval1 },
      { employeeId: "e2", employeeName: "Bob", evalResult: eval2 },
    ],
    codeToName
  );

  assert.equal(blockers.length, 2, "FIRE_SAFETY missing for both, BAM_GRUND missing for e2");
  const fireSafety = blockers.find((b) => b.code === "FIRE_SAFETY");
  assert.ok(fireSafety);
  assert.equal(fireSafety.name, "Brandskydd");
  assert.equal(fireSafety.status, "EXPIRED", "e2 has expired so aggregate is EXPIRED");
  assert.equal(fireSafety.affected_employees.length, 2);
  assert.deepEqual(
    fireSafety.affected_employees.map((a) => a.employee_id).sort(),
    ["e1", "e2"]
  );

  const bamGrund = blockers.find((b) => b.code === "BAM_GRUND");
  assert.ok(bamGrund);
  assert.equal(bamGrund.affected_employees.length, 1);
  assert.equal(bamGrund.affected_employees[0].employee_id, "e2");
  assert.equal(bamGrund.affected_employees[0].name, "Bob");
});

test("buildStationComplianceDetail produces warnings with EXPIRING_7 and EXPIRING_30", () => {
  const future7 = new Date();
  future7.setDate(future7.getDate() + 5);
  const future30 = new Date();
  future30.setDate(future30.getDate() + 15);

  const required = ["CPR"];
  const codeToName = new Map([["CPR", "CPR"]]);
  const emp1Records = new Map([
    ["CPR", { code: "CPR", valid_to: future7.toISOString().slice(0, 10), waived: false }],
  ]);
  const emp2Records = new Map([
    ["CPR", { code: "CPR", valid_to: future30.toISOString().slice(0, 10), waived: false }],
  ]);

  const eval1 = evaluateEmployeeCompliance(required, emp1Records);
  const eval2 = evaluateEmployeeCompliance(required, emp2Records);

  const { blockers, warnings } = buildStationComplianceDetail(
    [
      { employeeId: "e1", employeeName: "Alice", evalResult: eval1 },
      { employeeId: "e2", employeeName: "Bob", evalResult: eval2 },
    ],
    codeToName
  );

  assert.equal(blockers.length, 0);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].code, "CPR");
  assert.equal(warnings[0].name, "CPR");
  assert.ok(warnings[0].status === "EXPIRING_7" || warnings[0].status === "EXPIRING_30");
  assert.ok(typeof warnings[0].valid_to === "string");
  assert.ok(typeof warnings[0].days_left === "number");
  assert.equal(warnings[0].affected_employees.length, 2);
});

test("buildStationComplianceDetail uses code as name when not in codeToName", () => {
  const required = ["UNKNOWN_CODE"];
  const records = new Map([
    ["UNKNOWN_CODE", { code: "UNKNOWN_CODE", valid_to: null, waived: false }],
  ]);
  const evalResult = evaluateEmployeeCompliance(required, records);
  const { blockers } = buildStationComplianceDetail(
    [{ employeeId: "e1", employeeName: "Alice", evalResult }],
    new Map()
  );
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0].name, "UNKNOWN_CODE");
  assert.equal(blockers[0].code, "UNKNOWN_CODE");
});
