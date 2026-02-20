import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateEmployeeLegitimacy,
  type ComplianceStatusForLegitimacy,
} from "../../lib/domain/legitimacy/evaluateEmployeeLegitimacy";

test("evaluateEmployeeLegitimacy - Restricted overrides everything", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: ["ILLEGAL", "WARNING"],
    inductionStatus: "RESTRICTED",
    disciplinaryRestriction: true,
  });
  assert.equal(r.legitimacyStatus, "RESTRICTED");
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.warnings, []);
});

test("evaluateEmployeeLegitimacy - Disciplinary overrides compliance warning", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: ["WARNING", "VALID"],
    inductionStatus: "CLEARED",
    disciplinaryRestriction: true,
  });
  assert.equal(r.legitimacyStatus, "ILLEGAL");
  assert.deepEqual(r.blockers, ["DISCIPLINARY_RESTRICTION"]);
  assert.deepEqual(r.warnings, []);
});

test("evaluateEmployeeLegitimacy - Compliance ILLEGAL overrides WARNING", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: ["WARNING", "ILLEGAL", "VALID"] as ComplianceStatusForLegitimacy[],
    inductionStatus: "CLEARED",
    disciplinaryRestriction: false,
  });
  assert.equal(r.legitimacyStatus, "ILLEGAL");
  assert.deepEqual(r.blockers, ["COMPLIANCE_EXPIRED"]);
  assert.deepEqual(r.warnings, []);
});

test("evaluateEmployeeLegitimacy - Only WARNING → WARNING", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: ["VALID", "WARNING", "VALID"],
    inductionStatus: "CLEARED",
    disciplinaryRestriction: false,
  });
  assert.equal(r.legitimacyStatus, "WARNING");
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.warnings, ["COMPLIANCE_EXPIRING"]);
});

test("evaluateEmployeeLegitimacy - All valid → GO", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: ["VALID", "VALID"],
    inductionStatus: "CLEARED",
    disciplinaryRestriction: false,
  });
  assert.equal(r.legitimacyStatus, "GO");
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.warnings, []);
});

test("evaluateEmployeeLegitimacy - Priority ordering: RESTRICTED > disciplinary > ILLEGAL > WARNING > GO", () => {
  // 1) RESTRICTED wins even with disciplinary + ILLEGAL
  assert.equal(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["ILLEGAL"],
      inductionStatus: "RESTRICTED",
      disciplinaryRestriction: true,
    }).legitimacyStatus,
    "RESTRICTED"
  );
  // 2) CLEARED + disciplinary wins over compliance ILLEGAL
  assert.equal(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["ILLEGAL"],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: true,
    }).legitimacyStatus,
    "ILLEGAL"
  );
  assert.deepEqual(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["ILLEGAL"],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: true,
    }).blockers,
    ["DISCIPLINARY_RESTRICTION"]
  );
  // 3) ILLEGAL in compliance wins over WARNING
  assert.equal(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["WARNING", "ILLEGAL"],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: false,
    }).legitimacyStatus,
    "ILLEGAL"
  );
  assert.deepEqual(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["WARNING", "ILLEGAL"],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: false,
    }).blockers,
    ["COMPLIANCE_EXPIRED"]
  );
  // 4) Only WARNING yields WARNING
  assert.equal(
    evaluateEmployeeLegitimacy({
      complianceStatuses: ["WARNING"],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: false,
    }).legitimacyStatus,
    "WARNING"
  );
  // 5) All VALID yields GO
  assert.equal(
    evaluateEmployeeLegitimacy({
      complianceStatuses: [],
      inductionStatus: "CLEARED",
      disciplinaryRestriction: false,
    }).legitimacyStatus,
    "GO"
  );
});

test("evaluateEmployeeLegitimacy - Empty compliance statuses, cleared, no disciplinary → GO", () => {
  const r = evaluateEmployeeLegitimacy({
    complianceStatuses: [],
    inductionStatus: "CLEARED",
    disciplinaryRestriction: false,
  });
  assert.equal(r.legitimacyStatus, "GO");
  assert.deepEqual(r.blockers, []);
  assert.deepEqual(r.warnings, []);
});
