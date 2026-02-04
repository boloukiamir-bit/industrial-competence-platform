/**
 * Unit tests for CSV escaping (commas, newlines, quotes).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsvField } from "@/lib/csvEscape";

test("escapeCsvField - plain string unchanged", () => {
  assert.equal(escapeCsvField("hello"), "hello");
  assert.equal(escapeCsvField(""), "");
});

test("escapeCsvField - null and undefined become empty", () => {
  assert.equal(escapeCsvField(null), "");
  assert.equal(escapeCsvField(undefined), "");
});

test("escapeCsvField - comma wraps in quotes", () => {
  assert.equal(escapeCsvField("a,b"), '"a,b"');
  assert.equal(escapeCsvField("Smith, John"), '"Smith, John"');
});

test("escapeCsvField - newline wraps in quotes", () => {
  assert.equal(escapeCsvField("line1\nline2"), '"line1\nline2"');
  assert.equal(escapeCsvField("a\n"), '"a\n"');
});

test("escapeCsvField - double quote escaped and wrapped", () => {
  assert.equal(escapeCsvField('say "hello"'), '"say ""hello"""');
  assert.equal(escapeCsvField('""'), '""""""');
});

test("escapeCsvField - comma and quote together", () => {
  assert.equal(escapeCsvField('"a", b'), '"""a"", b"');
});
