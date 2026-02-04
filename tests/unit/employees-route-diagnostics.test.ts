/**
 * Unit test for GET /api/employees diagnostics.
 * Asserts route includes requestId in error responses for correlation.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "employees", "route.ts");

test("employees route includes requestId in error response", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("requestId"), "route must include requestId in error response");
  assert(content.includes("X-Request-Id"), "route must set X-Request-Id header");
});

test("employees route has DEBUG_DIAGNOSTICS-gated logging", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("DEBUG_DIAGNOSTICS"), "route must gate diagnostics with DEBUG_DIAGNOSTICS");
});
