/**
 * Placeholder stations (code LIKE 'LINE-%') must be excluded from /api/tomorrows-gaps.
 * Given 1 real station + 1 LINE- placeholder, response stations must include only the real one.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isPlaceholderStation } from "@/lib/server/lineToStation";

test("isPlaceholderStation identifies LINE-* and allows null/real codes", () => {
  assert.equal(isPlaceholderStation({ code: "LINE-Bearbetning" }), true);
  assert.equal(isPlaceholderStation({ code: "LINE-X" }), true);
  assert.equal(isPlaceholderStation({ code: "B-01" }), false);
  assert.equal(isPlaceholderStation({ code: null }), false);
  assert.equal(isPlaceholderStation({}), false);
});

test("filtering 1 real + 1 LINE- placeholder leaves only real station", () => {
  const rows = [
    { id: "st1", code: "B-01", name: "Station B-01", line: "Bearbetning" },
    { id: "st2", code: "LINE-Bearbetning", name: "Bearbetning (LINE)", line: "Bearbetning" },
  ];
  const operational = rows.filter((s) => !isPlaceholderStation(s));
  assert.equal(operational.length, 1, "stations list must contain only the real station");
  assert.equal(operational[0].code, "B-01");
  assert.equal(operational[0].id, "st1");
});
