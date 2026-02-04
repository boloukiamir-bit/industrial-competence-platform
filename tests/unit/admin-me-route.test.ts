/**
 * Unit test for GET /api/admin/me.
 * Asserts route source includes no-cache config so the endpoint is never cached in production.
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const routePath = join(process.cwd(), "app", "api", "admin", "me", "route.ts");

test("admin/me route source includes force-dynamic and revalidate=0", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes('export const dynamic = "force-dynamic"'), "route must export dynamic force-dynamic");
  assert(content.includes("export const revalidate = 0"), "route must export revalidate 0");
});

test("admin/me route source includes Cache-Control no-store", () => {
  const content = readFileSync(routePath, "utf-8");
  assert(content.includes("Cache-Control"), "route must set Cache-Control header");
  assert(content.includes("no-store"), "route must include no-store in Cache-Control");
});
