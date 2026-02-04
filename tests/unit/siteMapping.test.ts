/**
 * Unit tests for resolveOrgUnitIdForSessionSite.
 * - When activeSiteId equals an org_units.id => returns same id.
 * - When activeSiteId is a sites.id with name matching exactly one org_unit => returns that org_unit id.
 * - When no site row => null.
 * - When multiple org_units same name => null.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { resolveOrgUnitIdForSessionSite } from "@/lib/server/siteMapping";
import type { SupabaseClient } from "@supabase/supabase-js";

type OrgUnitsDirect = { id: string } | null;
type SiteRow = { id: string; name: string } | null;
type OrgUnitsByName = Array<{ id: string; name: string }>;

function mockSupabaseAdmin(
  orgUnitsDirect: OrgUnitsDirect,
  siteRow: SiteRow,
  orgUnitsByName: OrgUnitsByName
): SupabaseClient {
  const from = (table: string) => {
    return {
      select: (cols: string) => ({
        eq: (col: string, _val: unknown) => {
          if (table === "org_units" && cols === "id" && col === "id") {
            return {
              eq: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: orgUnitsDirect, error: null }),
                }),
              }),
            };
          }
          if (table === "org_units" && cols.includes("name") && col === "org_id") {
            return {
              eq: () => ({
                limit: () => Promise.resolve({ data: orgUnitsByName, error: null }),
              }),
            };
          }
          if (table === "sites" && col === "id") {
            return {
              eq: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: siteRow, error: null }),
                }),
              }),
            };
          }
          throw new Error(`unexpected: table=${table} cols=${cols} col=${col}`);
        },
      }),
    };
  };
  return { from } as unknown as SupabaseClient;
}

test("resolveOrgUnitIdForSessionSite - activeSiteId null => null", async () => {
  const supabase = mockSupabaseAdmin(null, null, []);
  const out = await resolveOrgUnitIdForSessionSite(supabase, "org-1", null);
  assert.equal(out, null);
});

test("resolveOrgUnitIdForSessionSite - activeSiteId equals org_units.id => returns same id", async () => {
  const unitId = "unit-uuid-1";
  const supabase = mockSupabaseAdmin({ id: unitId }, null, []);
  const out = await resolveOrgUnitIdForSessionSite(supabase, "org-1", unitId);
  assert.equal(out, unitId);
});

test("resolveOrgUnitIdForSessionSite - no site row => null", async () => {
  const siteId = "site-uuid-1";
  const supabase = mockSupabaseAdmin(null, null, []);
  const out = await resolveOrgUnitIdForSessionSite(supabase, "org-1", siteId);
  assert.equal(out, null);
});

test("resolveOrgUnitIdForSessionSite - site name matches exactly one org_unit => returns that org_unit id", async () => {
  const siteId = "site-uuid-1";
  const unitId = "unit-uuid-2";
  const supabase = mockSupabaseAdmin(
    null,
    { id: siteId, name: "Main Site" },
    [{ id: unitId, name: "Main Site" }]
  );
  const out = await resolveOrgUnitIdForSessionSite(supabase, "org-1", siteId);
  assert.equal(out, unitId);
});

test("resolveOrgUnitIdForSessionSite - multiple org_units same name => null", async () => {
  const siteId = "site-uuid-1";
  const supabase = mockSupabaseAdmin(
    null,
    { id: siteId, name: "Duplicate" },
    [
      { id: "unit-a", name: "Duplicate" },
      { id: "unit-b", name: "Duplicate" },
    ]
  );
  const out = await resolveOrgUnitIdForSessionSite(supabase, "org-1", siteId);
  assert.equal(out, null);
});
