/**
 * P1.8 Pilot Execution Pack: seed route is blocked in production when ALLOW_PILOT_SEED is not set.
 * Source test to avoid loading route (which creates Supabase client at module load).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const seedRoutePath = join(process.cwd(), "app", "api", "compliance", "pilot", "seed", "route.ts");

describe("Compliance pilot seed guard", () => {
  it("route source blocks production when ALLOW_PILOT_SEED is not set", () => {
    const content = readFileSync(seedRoutePath, "utf-8");
    assert(content.includes("NODE_ENV"), "route must check NODE_ENV");
    assert(content.includes("ALLOW_PILOT_SEED"), "route must check ALLOW_PILOT_SEED");
    assert(
      content.includes("production") && content.includes("403"),
      "route must return 403 in production when guard fails"
    );
    assert(
      content.includes("IS_PRODUCTION") || (content.includes("NODE_ENV") && content.includes("ALLOW_PILOT_SEED")),
      "route must gate on production and ALLOW_PILOT_SEED"
    );
  });
});
