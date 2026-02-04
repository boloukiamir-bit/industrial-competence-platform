/**
 * Unit test for renderDraftForAction: template_missing yields template_status=missing.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { renderDraftForAction } from "@/lib/server/complianceDraftRender";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockSupabaseForDraft(orgUnitsPrimary: { name: string } | null, orgUnitsFallback: Array<{ name: string }>, templateRows: unknown[]): SupabaseClient {
  const from = (table: string) => {
    if (table === "org_units") {
      return {
        select: (_cols: string) => ({
          eq: (col: string, _val: unknown) => {
            if (col === "org_id") {
              return Promise.resolve({ data: orgUnitsFallback, error: null });
            }
            return {
              eq: () => ({
                limit: () => ({
                  maybeSingle: () => Promise.resolve({ data: orgUnitsPrimary, error: null }),
                }),
              }),
            };
          },
        }),
      };
    }
    if (table === "hr_templates") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                in: () => Promise.resolve({ data: templateRows, error: null }),
              }),
            }),
          }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  };
  return { from } as unknown as SupabaseClient;
}

test("renderDraftForAction when no template returns template_status missing", async () => {
  const supabase = mockSupabaseForDraft(null, [{ name: "Main" }], []);
  const result = await renderDraftForAction(
    supabase,
    "org-1",
    null,
    {
      action_type: "request_renewal",
      due_date: "2025-12-31",
      site_id: "site-1",
      employee_name: "Jane",
      employee_site_id: "site-1",
      compliance_code: "LIC",
      compliance_name: "License",
      line: "L1",
    },
    "email"
  );
  assert.equal(result.template_status, "missing");
  assert.equal(result.subject, "");
  assert.equal(result.body, "");
});
