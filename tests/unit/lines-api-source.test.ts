/**
 * Cheap unit check: line list APIs must return source="stations" so UI can confirm canonical source.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = (p: string) => join(process.cwd(), "app", "api", ...p.split("/"), "route.ts");

test("GET /api/lines returns source: stations", () => {
  const content = readFileSync(routePath("lines"), "utf-8");
  assert(content.includes('source: "stations"'), "lines route must return source: stations");
});

test("getActiveLines helper exists and is used by lines route", () => {
  const content = readFileSync(routePath("lines"), "utf-8");
  assert(content.includes("getActiveLines"), "lines route must use getActiveLines");
});
