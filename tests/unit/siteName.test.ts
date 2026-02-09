/**
 * Unit tests for getActiveSiteName fallback logic.
 * - When activeSiteId not found and only one site exists => returns that name.
 * - When multiple sites exist => returns null.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getActiveSiteName } from "@/lib/server/siteName";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabase(primary: { name: string } | null, fallbackUnits: Array<{ name: string }>): SupabaseClient {
  const from = (table: string) => {
    if (table !== "sites") throw new Error("unexpected table");
    return {
      select: (_cols: string) => ({
        eq: (col: string, _val: unknown) => {
          if (col === "org_id") {
            return Promise.resolve({ data: fallbackUnits, error: null });
          }
          return {
            eq: (_col2: string, _val2: unknown) => ({
              limit: (_n: number) => ({
                maybeSingle: () => Promise.resolve({ data: primary, error: null }),
              }),
            }),
            limit: (_n: number) => ({
              maybeSingle: () => Promise.resolve({ data: primary, error: null }),
            }),
          };
        },
      }),
    };
  };
  return { from } as unknown as SupabaseClient;
}

test("getActiveSiteName - primary hit returns unit name", async () => {
  const supabase = mockSupabase({ name: "Spaljisten - Main" }, []);
  const name = await getActiveSiteName(supabase, "some-id", "org-1");
  assert.equal(name, "Spaljisten - Main");
});

test("getActiveSiteName - activeSiteId not found and only one org_unit exists => returns that name", async () => {
  const supabase = mockSupabase(null, [{ name: "Main" }]);
  const name = await getActiveSiteName(supabase, "missing-id", "org-1");
  assert.equal(name, "Main");
});

test("getActiveSiteName - multiple org_units => returns null", async () => {
  const supabase = mockSupabase(null, [{ name: "Site A" }, { name: "Site B" }]);
  const name = await getActiveSiteName(supabase, "missing-id", "org-1");
  assert.equal(name, null);
});

test("getActiveSiteName - primary null and no orgId => returns null", async () => {
  const supabase = mockSupabase(null, []);
  const name = await getActiveSiteName(supabase, "missing-id", undefined);
  assert.equal(name, null);
});
