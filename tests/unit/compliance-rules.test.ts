import test from "node:test";
import assert from "node:assert/strict";
import {
  requiredComplianceForContext,
  bucketComplianceStatus,
  evaluateEmployeeCompliance,
  COMPLIANCE_RISK_POINTS,
} from "@/lib/compliance/rules";

const orgId = "00000000-0000-0000-0000-000000000001";
const siteId = "00000000-0000-0000-0000-000000000002";

test("requiredComplianceForContext includes work_environment and sustainability for any shift", () => {
  const ctx = { org_id: orgId, site_id: siteId, shift_code: "Day" };
  const codes = requiredComplianceForContext(ctx);
  assert.ok(codes.includes("BAM_GRUND"));
  assert.ok(codes.includes("FIRE_SAFETY"));
  assert.ok(codes.includes("FSC"));
  assert.ok(!codes.includes("NIGHT_EXAM"), "Day shift should not require NIGHT_EXAM");
});

test("requiredComplianceForContext adds NIGHT_EXAM for Night shift", () => {
  const ctx = { org_id: orgId, site_id: siteId, shift_code: "Night" };
  const codes = requiredComplianceForContext(ctx);
  assert.ok(codes.includes("NIGHT_EXAM"));
  assert.ok(codes.includes("BAM_GRUND"));
});

test("requiredComplianceForContext adds IKEA codes when customer_code is IKEA", () => {
  const ctx = {
    org_id: orgId,
    site_id: siteId,
    shift_code: "Day",
    customer_code: "IKEA",
  };
  const codes = requiredComplianceForContext(ctx);
  assert.ok(codes.includes("IKEA_IWAY"));
  assert.ok(codes.includes("IKEA_BUSINESS_ETHICS"));
});

test("requiredComplianceForContext normalizes shift aliases", () => {
  const nightCodes = requiredComplianceForContext({
    org_id: orgId,
    site_id: siteId,
    shift_code: "3",
  });
  assert.ok(nightCodes.includes("NIGHT_EXAM"));
});

test("bucketComplianceStatus: missing when no valid_to", () => {
  const { bucket } = bucketComplianceStatus(null, false);
  assert.equal(bucket, "missing");
});

test("bucketComplianceStatus: expired when valid_to in past", () => {
  const past = new Date();
  past.setDate(past.getDate() - 10);
  const { bucket } = bucketComplianceStatus(past.toISOString().slice(0, 10), false);
  assert.equal(bucket, "expired");
});

test("bucketComplianceStatus: expiring_7 when valid_to within 7 days", () => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 5);
  const { bucket, daysLeft } = bucketComplianceStatus(soon.toISOString().slice(0, 10), false);
  assert.equal(bucket, "expiring_7");
  assert.ok(daysLeft !== null && daysLeft <= 7);
});

test("bucketComplianceStatus: expiring_30 when valid_to within 30 days", () => {
  const later = new Date();
  later.setDate(later.getDate() + 15);
  const { bucket } = bucketComplianceStatus(later.toISOString().slice(0, 10), false);
  assert.equal(bucket, "expiring_30");
});

test("bucketComplianceStatus: valid when valid_to beyond 30 days", () => {
  const future = new Date();
  future.setDate(future.getDate() + 60);
  const { bucket } = bucketComplianceStatus(future.toISOString().slice(0, 10), false);
  assert.equal(bucket, "valid");
});

test("COMPLIANCE_RISK_POINTS match spec", () => {
  assert.equal(COMPLIANCE_RISK_POINTS.valid, 0);
  assert.equal(COMPLIANCE_RISK_POINTS.expiring_30, 3);
  assert.equal(COMPLIANCE_RISK_POINTS.expiring_7, 6);
  assert.equal(COMPLIANCE_RISK_POINTS.expired, 12);
  assert.equal(COMPLIANCE_RISK_POINTS.missing, 20);
});

test("evaluateEmployeeCompliance aggregates risk and buckets", () => {
  const required = ["BAM_GRUND", "FIRE_SAFETY", "NIGHT_EXAM"];
  const records = new Map([
    ["BAM_GRUND", { code: "BAM_GRUND", valid_to: "2030-01-01", waived: false }],
    ["FIRE_SAFETY", { code: "FIRE_SAFETY", valid_to: null, waived: false }],
    // NIGHT_EXAM missing
  ]);
  const result = evaluateEmployeeCompliance(required, records);
  assert.deepEqual(result.missing, ["FIRE_SAFETY", "NIGHT_EXAM"]);
  assert.deepEqual(result.valid, ["BAM_GRUND"]);
  assert.equal(
    result.risk_points,
    COMPLIANCE_RISK_POINTS.valid + COMPLIANCE_RISK_POINTS.missing * 2
  );
});
