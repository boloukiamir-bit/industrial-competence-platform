#!/usr/bin/env tsx
/**
 * Smoke test for Compliance API (catalog + employee compliance + overview).
 * Requires SUPABASE_URL + SERVICE_ROLE_KEY. Allows ORG_ID override.
 * Creates catalog item, assigns to employee, verifies overview KPIs update, then cleanup.
 *
 * Usage:
 *   tsx scripts/smoke-compliance.ts
 *   ORG_ID=<uuid> tsx scripts/smoke-compliance.ts
 *   tsx scripts/smoke-compliance.ts --org <uuid>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type TestResult = { test: string; passed: boolean; details?: string; data?: unknown };
const results: TestResult[] = [];

function log(test: string, passed: boolean, details?: string, data?: unknown) {
  results.push({ test, passed, details, data });
  const icon = passed ? "✅" : "❌";
  console.log(`${icon} ${test}${details ? `: ${details}` : ""}`);
  if (data && !passed) {
    console.log("   Data:", JSON.stringify(data, null, 2));
  }
}

function parseArgs(argv: string[]): { orgArg: string | null } {
  let orgArg: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--org" && argv[i + 1]) {
      orgArg = argv[i + 1];
      i++;
    }
  }
  return { orgArg };
}

async function main() {
  const { orgArg } = parseArgs(process.argv.slice(2));
  const orgIdOverride = (process.env.ORG_ID ?? orgArg)?.trim() || null;

  console.log("\n🔍 Compliance Smoke Test");
  console.log(`   ORG_ID override: ${orgIdOverride ?? "none (use first active)"}\n`);

  let orgId: string;
  let orgName: string;

  if (orgIdOverride) {
    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .eq("id", orgIdOverride)
      .maybeSingle();
    if (orgError || !org) {
      log("Resolve org", false, orgError?.message ?? "Organization not found");
      console.error("\n❌ Invalid ORG_ID/--org. Check UUID and DB.");
      process.exit(1);
    }
    orgId = org.id;
    orgName = org.name;
    log("Resolve org", true, `${orgName} (${orgId})`);
  } else {
    const { data: orgs, error: orgsError } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .limit(1);
    if (orgsError || !orgs?.length) {
      log("Get org", false, orgsError?.message ?? "No organizations found");
      console.error("\n❌ Set ORG_ID or --org <uuid>, or ensure an organization exists.");
      process.exit(1);
    }
    orgId = orgs[0].id;
    orgName = orgs[0].name;
    log("Get org", true, `${orgName} (${orgId})`);
  }

  const { data: employees, error: empErr } = await supabaseAdmin
    .from("employees")
    .select("id, name, site_id")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .limit(1);
  if (empErr || !employees?.length) {
    log("Get employee", false, empErr?.message ?? "No active employees");
    console.error("\n❌ Ensure at least one active employee in org.");
    process.exit(1);
  }
  const employee = employees[0] as { id: string; name: string; site_id: string | null };
  log("Get employee", true, `${employee.name} (${employee.id})`);

  if (!employee.site_id) {
    throw new Error(
      `Employee ${employee.id} (${employee.name}) has NULL site_id. Backfill employees.site_id for org ${orgId} before running smoke.`
    );
  }

  const code = "SMOKE_COMPLIANCE_" + Date.now();
  const { data: catalogRow, error: catInsErr } = await supabaseAdmin
    .from("compliance_catalog")
    .insert({
      org_id: orgId,
      site_id: null,
      category: "license",
      code,
      name: "Smoke test catalog item",
      description: "Created by smoke-compliance.ts",
      default_validity_days: 365,
      is_active: true,
    })
    .select("id")
    .single();

  if (catInsErr || !catalogRow) {
    log("Create catalog item", false, catInsErr?.message, catalogRow);
    process.exit(1);
  }
  log("Create catalog item", true, `id=${catalogRow.id}`);

  const validFrom = new Date().toISOString().slice(0, 10);
  const validTo = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: empCompRow, error: ecInsErr } = await supabaseAdmin
    .from("employee_compliance")
    .upsert(
      {
        org_id: orgId,
        site_id: employee.site_id,
        employee_id: employee.id,
        compliance_id: catalogRow.id,
        valid_from: validFrom,
        valid_to: validTo,
        evidence_url: null,
        notes: "Smoke test",
        waived: false,
      },
      { onConflict: "org_id,employee_id,compliance_id" }
    )
    .select("id")
    .single();

  if (ecInsErr || !empCompRow) {
    log("Assign employee compliance", false, ecInsErr?.message, empCompRow);
    await supabaseAdmin.from("compliance_catalog").delete().eq("id", catalogRow.id);
    process.exit(1);
  }
  log("Assign employee compliance", true, `id=${empCompRow.id}`);

  const { data: overviewRows, error: ovErr } = await supabaseAdmin
    .from("employee_compliance")
    .select("id, employee_id, compliance_id, valid_to, waived")
    .eq("org_id", orgId)
    .eq("employee_id", employee.id);
  if (ovErr) {
    log("Verify overview data", false, ovErr.message);
  } else {
    const count = overviewRows?.length ?? 0;
    log("Verify overview data", count >= 1, `employee has ${count} compliance row(s)`);
  }

  const { error: delEcErr } = await supabaseAdmin
    .from("employee_compliance")
    .delete()
    .eq("id", empCompRow.id);
  log("Cleanup employee_compliance", !delEcErr, delEcErr?.message);

  const { error: delCatErr } = await supabaseAdmin
    .from("compliance_catalog")
    .delete()
    .eq("id", catalogRow.id);
  log("Cleanup compliance_catalog", !delCatErr, delCatErr?.message);

  console.log("\n📊 Summary:");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`   ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log("\n✅ All compliance smoke tests passed!\n");
    process.exit(0);
  } else {
    console.log("\n❌ Some tests failed\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
