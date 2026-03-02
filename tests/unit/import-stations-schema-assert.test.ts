/**
 * Unit test: import/stations route must assert stations schema and return 400 on mismatch.
 * Ensures we do not silently insert into wrong columns if schema drifts.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "admin", "import", "stations", "route.ts");

test("import/stations route asserts stations schema and returns 400 on mismatch", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(
    content.includes("assertStationsSchema"),
    "route must call assertStationsSchema to detect schema mismatch"
  );
  assert(
    content.includes("SCHEMA_MISMATCH"),
    "route must return code SCHEMA_MISMATCH when schema assertion fails"
  );
  assert(
    content.includes("status: 400") && content.includes("schemaErr"),
    "route must return 400 with schema error message on mismatch"
  );
  assert(
    content.includes("Stations schema mismatch") || content.includes("schema mismatch"),
    "route must include actionable error message for stations schema mismatch"
  );
});

test("import/stations route uses stations unique key (org_id, area_code, code)", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("area_code") && content.includes("org_id"), "route must use org_id and area_code");
  assert(
    content.includes('eq("code"') || content.includes(".eq('code'"),
    "route must filter stations by code for upsert key"
  );
});
