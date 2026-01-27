import test from "node:test";
import assert from "node:assert/strict";
import { normalizeToDateString, daysBetween, getTodayInOrgTimezone } from "@/app/api/hr/tasks/route";

test("HR Tasks Date Utilities - normalizeToDateString - should return YYYY-MM-DD string unchanged", () => {
  assert.equal(normalizeToDateString("2026-01-31"), "2026-01-31");
  assert.equal(normalizeToDateString("2025-12-25"), "2025-12-25");
});

test("HR Tasks Date Utilities - normalizeToDateString - should normalize ISO timestamp strings to YYYY-MM-DD", () => {
  assert.equal(normalizeToDateString("2026-01-31T23:00:00.000Z"), "2026-01-31");
  assert.equal(normalizeToDateString("2026-01-31T00:00:00.000Z"), "2026-01-31");
  assert.equal(normalizeToDateString("2026-01-31T12:30:45.123Z"), "2026-01-31");
});

test("HR Tasks Date Utilities - normalizeToDateString - should normalize Date objects to YYYY-MM-DD", () => {
  const date = new Date("2026-01-31T23:00:00.000Z");
  assert.equal(normalizeToDateString(date), "2026-01-31");
});

test("HR Tasks Date Utilities - normalizeToDateString - should handle dates at different times of day consistently", () => {
  assert.equal(normalizeToDateString("2026-01-31T00:00:00.000Z"), "2026-01-31");
  assert.equal(normalizeToDateString("2026-01-31T12:00:00.000Z"), "2026-01-31");
  assert.equal(normalizeToDateString("2026-01-31T23:59:59.999Z"), "2026-01-31");
});

test("HR Tasks Date Utilities - daysBetween - should calculate days difference correctly", () => {
  assert.equal(daysBetween("2026-01-31", "2026-01-31"), 0);
  assert.equal(daysBetween("2026-02-01", "2026-01-31"), 1);
  assert.equal(daysBetween("2026-01-31", "2026-02-01"), -1);
});

test("HR Tasks Date Utilities - daysBetween - should handle multi-day differences", () => {
  assert.equal(daysBetween("2026-02-05", "2026-01-31"), 5);
  assert.equal(daysBetween("2026-01-26", "2026-01-31"), -5);
  assert.equal(daysBetween("2026-03-01", "2026-01-31"), 29);
});

test("HR Tasks Date Utilities - daysBetween - should handle overdue dates (negative days)", () => {
  assert.equal(daysBetween("2026-01-30", "2026-01-31"), -1);
  assert.equal(daysBetween("2026-01-24", "2026-01-31"), -7);
});

test("HR Tasks Date Utilities - daysBetween - should handle future dates (positive days)", () => {
  assert.equal(daysBetween("2026-02-01", "2026-01-31"), 1);
  assert.equal(daysBetween("2026-02-07", "2026-01-31"), 7);
  assert.equal(daysBetween("2026-02-28", "2026-01-31"), 28);
});

test("HR Tasks Date Utilities - getTodayInOrgTimezone - should return a valid YYYY-MM-DD format string", () => {
  const today = getTodayInOrgTimezone();
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today));
});

test("HR Tasks Date Utilities - getTodayInOrgTimezone - should return a date string that can be parsed", () => {
  const today = getTodayInOrgTimezone();
  const parsed = new Date(today + "T00:00:00.000Z");
  assert.ok(!isNaN(parsed.getTime()));
});

test("HR Tasks Date Utilities - Integration: date normalization + days calculation - should correctly compute days_to_expiry for various date formats", () => {
  const today = getTodayInOrgTimezone();
  
  // Test with ISO timestamp (what DB might return)
  const isoDate = "2026-01-31T23:00:00.000Z";
  const normalized = normalizeToDateString(isoDate);
  const days = daysBetween(normalized, today);
  
  assert.equal(normalized, "2026-01-31");
  assert.equal(typeof days, "number");
});

test("HR Tasks Date Utilities - Integration: date normalization + days calculation - should produce consistent results regardless of time component", () => {
  const today = getTodayInOrgTimezone();
  
  const dates = [
    "2026-01-31T00:00:00.000Z",
    "2026-01-31T12:00:00.000Z",
    "2026-01-31T23:59:59.999Z",
    "2026-01-31",
  ];
  
  const normalized = dates.map(normalizeToDateString);
  const allSame = normalized.every((d) => d === normalized[0]);
  assert.equal(allSame, true);
  
  const days = normalized.map((d) => daysBetween(d, today));
  const allDaysSame = days.every((d) => d === days[0]);
  assert.equal(allDaysSame, true);
});
