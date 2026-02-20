import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExpiryStatus } from "../../lib/domain/compliance/evaluateExpiryStatus";

const REF = new Date("2026-02-20T12:00:00.000Z");
const REMINDER_DAYS = 30;

test("evaluateExpiryStatus - expired yesterday → ILLEGAL", () => {
  const yesterday = new Date(REF);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  assert.equal(
    evaluateExpiryStatus({ expiryDate: yesterday, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "ILLEGAL"
  );
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-02-19", reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "ILLEGAL"
  );
});

test("evaluateExpiryStatus - expiring today → ILLEGAL", () => {
  const today = new Date(REF);
  today.setUTCHours(0, 0, 0, 0);
  assert.equal(
    evaluateExpiryStatus({ expiryDate: today, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "ILLEGAL"
  );
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-02-20", reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "ILLEGAL"
  );
});

test("evaluateExpiryStatus - expiring within reminder window → WARNING", () => {
  const inSeven = new Date(REF);
  inSeven.setUTCDate(inSeven.getUTCDate() + 7);
  assert.equal(
    evaluateExpiryStatus({ expiryDate: inSeven, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "WARNING"
  );
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-03-20", reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "WARNING"
  );
  const lastDayOfWindow = new Date(REF);
  lastDayOfWindow.setUTCDate(lastDayOfWindow.getUTCDate() + REMINDER_DAYS);
  assert.equal(
    evaluateExpiryStatus({ expiryDate: lastDayOfWindow, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "WARNING"
  );
});

test("evaluateExpiryStatus - expiring outside reminder window → VALID", () => {
  const inForty = new Date(REF);
  inForty.setUTCDate(inForty.getUTCDate() + 40);
  assert.equal(
    evaluateExpiryStatus({ expiryDate: inForty, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "VALID"
  );
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-04-01", reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "VALID"
  );
});

test("evaluateExpiryStatus - null expiry → VALID", () => {
  assert.equal(
    evaluateExpiryStatus({ expiryDate: null, reminderOffsetDays: REMINDER_DAYS, referenceDate: REF }),
    "VALID"
  );
});

test("evaluateExpiryStatus - edge case: timezone boundary (date-only compare)", () => {
  // Reference noon UTC 2026-02-20; expiry "2026-02-21" is next calendar day in UTC
  const ref = new Date("2026-02-20T12:00:00.000Z");
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-02-21T00:00:00.000Z", reminderOffsetDays: 0, referenceDate: ref }),
    "VALID"
  );
  // Same calendar day in UTC (2026-02-20) → ILLEGAL
  assert.equal(
    evaluateExpiryStatus({ expiryDate: "2026-02-20T23:59:59.999Z", reminderOffsetDays: 30, referenceDate: ref }),
    "ILLEGAL"
  );
});
