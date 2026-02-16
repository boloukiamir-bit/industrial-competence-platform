import test from "node:test";
import assert from "node:assert/strict";
import {
  toISODateString,
  parseDateForStorage,
  addDaysISO,
} from "@/lib/dateIso";

// Regression: cockpit selected date 2026-01-30 must persist and return as "2026-01-30" (no off-by-one in Europe/Stockholm).

test("dateIso - parseDateForStorage passes through YYYY-MM-DD exactly", () => {
  assert.equal(parseDateForStorage("2026-01-30"), "2026-01-30");
  assert.equal(parseDateForStorage("2026-01-30 "), "2026-01-30");
  assert.equal(parseDateForStorage("  2026-01-30"), "2026-01-30");
  assert.equal(parseDateForStorage("2026-01-30T00:00:00.000Z"), "2026-01-30");
  assert.equal(parseDateForStorage("2026-01-30T23:59:59.999Z"), "2026-01-30");
  assert.equal(parseDateForStorage(null), null);
  assert.equal(parseDateForStorage(""), null);
  assert.equal(parseDateForStorage("Fri Jan 30"), null); // no Date() parse — persist exact YYYY-MM-DD only
});

test("dateIso - toISODateString returns selected date when Date is midnight UTC (pg DATE)", () => {
  // node-pg returns DATE '2026-01-30' as Date 2026-01-30T00:00:00.000Z
  const pgDate = new Date("2026-01-30T00:00:00.000Z");
  assert.equal(toISODateString(pgDate), "2026-01-30");
});

test("dateIso - toISODateString passes through YYYY-MM-DD string", () => {
  assert.equal(toISODateString("2026-01-30"), "2026-01-30");
  assert.equal(toISODateString("2026-01-30T00:00:00.000Z"), "2026-01-30");
});

test("dateIso - addDaysISO preserves calendar day and adds 14", () => {
  assert.equal(addDaysISO("2026-01-30", 14), "2026-02-13");
  assert.equal(addDaysISO(null, 14).length, 10);
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(addDaysISO(null, 14)));
});

test("dateIso - round-trip: selectedDate 2026-01-30 persist and return", () => {
  const selectedDate = "2026-01-30";
  const forStorage = parseDateForStorage(selectedDate);
  assert.equal(forStorage, "2026-01-30");
  // Simulate DB returns Date (midnight UTC)
  const fromDb = new Date(forStorage + "T00:00:00.000Z");
  const forApi = toISODateString(fromDb);
  assert.equal(forApi, "2026-01-30", "inbox must show shift_date 2026-01-30");
});
