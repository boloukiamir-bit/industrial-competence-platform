import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Lås TLS-fixen: pgClient.ts must only re-export pool from lib/db/pool.
 * Pool creation (new Pool) must live in lib/db/pool.ts so SSL/pooler config is centralized.
 */
test("lib/pgClient.ts must not create Pool (no new Pool)", () => {
  const path = join(process.cwd(), "lib", "pgClient.ts");
  const content = readFileSync(path, "utf-8");
  assert.equal(
    content.includes("new Pool("),
    false,
    "lib/pgClient.ts must not contain 'new Pool('. Pool is created in lib/db/pool.ts only."
  );
});
