/**
 * Regression: GET /api/employees uses employees.line_code for filtering (canonical).
 * - Filter by lineCode uses line_code in WHERE.
 * - Response includes sourceLineField: "line_code".
 * - Each employee includes lineCode (from line_code).
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "employees", "route.ts");

test("employees route filters by line_code when lineCode param present", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("line_code"), "route must reference line_code");
  assert(content.includes("lineCode") || content.includes("line_code"), "route must use lineCode param or line_code column");
  assert(
    content.includes("line_code = $3"),
    "route must filter WHERE line_code = param"
  );
});

test("employees route returns sourceLineField: line_code", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(
    content.includes('sourceLineField: "line_code"') || content.includes("sourceLineField: 'line_code'"),
    "route must return sourceLineField: line_code in JSON response"
  );
});

test("employees route selects line_code and maps to lineCode on each employee", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("line_code") && content.includes("lineCode:"), "route must select line_code and map to lineCode");
});
