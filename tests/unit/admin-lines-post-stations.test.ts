/**
 * Unit check: Admin Master Data Lines POST writes to public.stations only, not pl_lines.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "admin", "master-data", "lines", "route.ts");

test("POST handler uses stations for upsert and does not write to pl_lines", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes('.from("stations")'), "POST must write to stations table");
  assert(content.includes("upsert"), "POST must use upsert for idempotent line create");
  assert(!content.includes('.from("pl_lines").insert') && !content.includes(".from('pl_lines').insert"), "POST must not insert into pl_lines");
  assert(!content.includes('.from("pl_lines").update') && !content.includes(".from('pl_lines').update"), "POST must not update pl_lines");
});

test("lineToStationPayload is used for POST", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("lineToStationPayload"), "POST must use lineToStationPayload for station row");
});
