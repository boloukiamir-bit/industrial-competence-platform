/**
 * P1.7 Export Pack: API test stub — tenant scoping and template_status=missing.
 * - Tenant scoping: route source uses getActiveOrgFromSession and org_id.
 * - template_missing: route uses renderDraftForAction and outputs template_status (ok|missing).
 */
import { readFileSync } from "fs";
import { join } from "path";
import test from "node:test";
import assert from "node:assert/strict";

const exportRoutePath = join(process.cwd(), "app", "api", "compliance", "actions", "export", "route.ts");

test("export route source uses getActiveOrgFromSession and org_id (tenant scoping)", () => {
  const content = readFileSync(exportRoutePath, "utf-8");
  assert(content.includes("getActiveOrgFromSession"), "route must use getActiveOrgFromSession");
  assert(content.includes('.eq("org_id", orgId)'), "route must filter by org_id");
  assert(content.includes("activeSiteId") && content.includes("site_id"), "route must respect activeSiteId");
});

test("export route includes template_status and uses renderDraftForAction (template_missing yields missing)", () => {
  const content = readFileSync(exportRoutePath, "utf-8");
  assert(content.includes("template_status"), "CSV must include template_status column");
  assert(content.includes("draft.template_status"), "route must output draft template_status (ok|missing)");
  assert(content.includes("renderDraftForAction"), "route must use renderDraftForAction");
});
