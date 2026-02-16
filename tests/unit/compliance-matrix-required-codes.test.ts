import test from "node:test";
import assert from "node:assert/strict";
import { requiredCodesForMatrix } from "@/lib/compliance/matrixRequiredCodes";

const BASE_CODES = [
  "BAM_GRUND",
  "BAM_FORTS",
  "FIRE_SAFETY",
  "FIRST_AID",
  "CPR",
  "HEARING_TEST",
  "VISION_TEST",
  "GENERAL_HEALTH",
  "FSC",
];

test("requiredCodesForMatrix includes base codes for any shift/customer", () => {
  const codes = requiredCodesForMatrix(null, null);
  for (const b of BASE_CODES) {
    assert.ok(codes.includes(b), `Base code ${b} should always be included`);
  }
  assert.ok(!codes.includes("NIGHT_EXAM"), "Day/default should not require NIGHT_EXAM");
  assert.ok(!codes.includes("IKEA_IWAY"), "Non-IKEA should not require IKEA codes");
});

test("requiredCodesForMatrix adds NIGHT_EXAM for Night shift", () => {
  const codes = requiredCodesForMatrix("Night", null);
  assert.ok(codes.includes("NIGHT_EXAM"), "Night shift should require NIGHT_EXAM");
  for (const b of BASE_CODES) {
    assert.ok(codes.includes(b), `Base code ${b} should be included`);
  }
});

test("requiredCodesForMatrix adds NIGHT_EXAM for S3 shift (case-insensitive)", () => {
  const codes = requiredCodesForMatrix("S3", null);
  assert.ok(codes.includes("NIGHT_EXAM"), "S3 shift should require NIGHT_EXAM");

  const codesLower = requiredCodesForMatrix("s3", null);
  assert.ok(codesLower.includes("NIGHT_EXAM"), "s3 (lowercase) should require NIGHT_EXAM");
});

test("requiredCodesForMatrix adds IKEA codes when customer_code is IKEA", () => {
  const codes = requiredCodesForMatrix("Day", "IKEA");
  assert.ok(codes.includes("IKEA_IWAY"), "IKEA customer should require IKEA_IWAY");
  assert.ok(codes.includes("IKEA_BUSINESS_ETHICS"), "IKEA customer should require IKEA_BUSINESS_ETHICS");
  for (const b of BASE_CODES) {
    assert.ok(codes.includes(b), `Base code ${b} should be included`);
  }
});

test("requiredCodesForMatrix does not add IKEA codes when customer is not IKEA", () => {
  const codes = requiredCodesForMatrix("Day", "OTHER");
  assert.ok(!codes.includes("IKEA_IWAY"));
  assert.ok(!codes.includes("IKEA_BUSINESS_ETHICS"));
});

test("requiredCodesForMatrix combines Night + IKEA when both apply", () => {
  const codes = requiredCodesForMatrix("Night", "IKEA");
  assert.ok(codes.includes("NIGHT_EXAM"));
  assert.ok(codes.includes("IKEA_IWAY"));
  assert.ok(codes.includes("IKEA_BUSINESS_ETHICS"));
  assert.equal(codes.filter((c) => c === "NIGHT_EXAM").length, 1, "NIGHT_EXAM should appear once");
});
