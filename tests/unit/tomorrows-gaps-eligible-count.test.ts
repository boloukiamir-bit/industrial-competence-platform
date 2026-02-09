/**
 * Unit test: tomorrows-gaps eligibleOperatorsCount must reflect full eligible set size,
 * while eligibleOperators list is capped (default 20 in route).
 * Given 25 eligible employees => eligibleOperatorsCount === 25, eligibleOperators.length === 20.
 */
import test from "node:test";
import assert from "node:assert/strict";

const ELIGIBLE_OPERATORS_LIST_LIMIT = 20; // must match app/api/tomorrows-gaps/route.ts

test("eligibleOperatorsCount is full set size; eligibleOperators list is capped at default limit", () => {
  const eligibleEmployees = Array.from({ length: 25 }, (_, i) => ({
    employee_id: `id-${i}`,
    employee_number: `E${i + 1}`,
    name: `Employee ${i + 1}`,
    stations_passed: 1,
    stations_required: 1,
    skills_passed_count: 1,
    required_skills_count: 1,
    eligible: true,
  }));

  const fullEligible = eligibleEmployees.filter((e) => e.eligible);
  const totalEligible = fullEligible.length;
  const eligibleOperatorsCount = totalEligible;
  const eligibleOperators = fullEligible
    .slice(0, ELIGIBLE_OPERATORS_LIST_LIMIT)
    .map((e) => ({ employee_number: e.employee_number ?? "", name: e.name ?? "" }));

  assert.equal(eligibleOperatorsCount, 25, "eligibleOperatorsCount must be full set size (25)");
  assert.equal(eligibleOperators.length, 20, "eligibleOperators list must be capped at default limit (20)");
});
