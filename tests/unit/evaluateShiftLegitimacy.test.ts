import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateShiftLegitimacy,
  type EmployeeLegitimacyStatus,
} from "../../lib/domain/legitimacy/evaluateShiftLegitimacy";

test("evaluateShiftLegitimacy - All GO → GO", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: ["GO", "GO", "GO"],
  });
  assert.equal(r.shiftStatus, "GO");
  assert.equal(r.illegalCount, 0);
  assert.equal(r.restrictedCount, 0);
  assert.equal(r.warningCount, 0);
});

test("evaluateShiftLegitimacy - One WARNING → WARNING", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: ["GO", "WARNING", "GO"],
  });
  assert.equal(r.shiftStatus, "WARNING");
  assert.equal(r.illegalCount, 0);
  assert.equal(r.restrictedCount, 0);
  assert.equal(r.warningCount, 1);
});

test("evaluateShiftLegitimacy - One ILLEGAL → ILLEGAL", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: ["GO", "ILLEGAL", "GO"],
  });
  assert.equal(r.shiftStatus, "ILLEGAL");
  assert.equal(r.illegalCount, 1);
  assert.equal(r.restrictedCount, 0);
  assert.equal(r.warningCount, 0);
});

test("evaluateShiftLegitimacy - One RESTRICTED → ILLEGAL", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: ["GO", "RESTRICTED", "GO"],
  });
  assert.equal(r.shiftStatus, "ILLEGAL");
  assert.equal(r.illegalCount, 0);
  assert.equal(r.restrictedCount, 1);
  assert.equal(r.warningCount, 0);
});

test("evaluateShiftLegitimacy - Mix of ILLEGAL + WARNING → ILLEGAL", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: ["WARNING", "ILLEGAL", "GO"] as EmployeeLegitimacyStatus[],
  });
  assert.equal(r.shiftStatus, "ILLEGAL");
  assert.equal(r.illegalCount, 1);
  assert.equal(r.restrictedCount, 0);
  assert.equal(r.warningCount, 1);
});

test("evaluateShiftLegitimacy - Empty array → GO", () => {
  const r = evaluateShiftLegitimacy({
    employeeLegitimacies: [],
  });
  assert.equal(r.shiftStatus, "GO");
  assert.equal(r.illegalCount, 0);
  assert.equal(r.restrictedCount, 0);
  assert.equal(r.warningCount, 0);
});
