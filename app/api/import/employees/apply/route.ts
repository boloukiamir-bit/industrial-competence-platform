/**
 * POST /api/import/employees/apply
 * Upserts employees from validated rows; org_id/site_id from active_org_id/active_site_id only.
 * Optionally deactivates org employees not in the file.
 * Creates employee_import_runs record with stats and error report.
 * All writes use user-scoped client so RLS is enforced.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseBody(body: unknown): { rows: Array<{ employee_number: string; name: string }>; deactivateNotInFile: boolean } {
  if (!body || typeof body !== "object") {
    return { rows: [], deactivateNotInFile: false };
  }
  const b = body as Record<string, unknown>;
  const rows = Array.isArray(b.rows) ? b.rows : [];
  const deactivateNotInFile = Boolean(b.deactivateNotInFile);
  const normalized = rows
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const row = r as Record<string, unknown>;
      const employee_number = typeof row.employee_number === "string" ? row.employee_number.trim() : "";
      const name = typeof row.name === "string" ? row.name.trim() : "";
      if (!employee_number || !name) return null;
      return { employee_number, name };
    })
    .filter((r): r is { employee_number: string; name: string } => r !== null);
  return { rows: normalized, deactivateNotInFile };
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("active_org_id, active_site_id")
      .eq("id", session.userId)
      .single();

    if (!profile?.active_org_id) {
      const res = NextResponse.json({ error: "No active organization" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const activeOrgId = profile.active_org_id as string;
    const activeSiteId = (profile?.active_site_id as string | null) ?? null;

    const body = await request.json().catch(() => ({}));
    const { rows, deactivateNotInFile } = parseBody(body);

    if (rows.length === 0) {
      const res = NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeNumbersInFile = new Set(rows.map((r) => r.employee_number));
    const errors: Array<{ rowIndex: number; message: string }> = [];
    let rowsImported = 0;
    let rowsFailed = 0;

    const { data: runRow, error: runInsertError } = await supabase
      .from("employee_import_runs")
      .insert({
        organization_id: activeOrgId,
        site_id: activeSiteId,
        created_by: session.userId,
        employee_count: 0,
        rows_imported: 0,
        rows_failed: 0,
        error_report: null,
      })
      .select("id")
      .single();

    if (runInsertError || !runRow?.id) {
      console.error("[import/employees/apply] run insert", runInsertError);
      const res = NextResponse.json({ error: "Failed to create import run" }, { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const importRunId = runRow.id;
    const now = new Date().toISOString();
    const toUpsert = rows.map((row) => ({
      org_id: activeOrgId,
      employee_number: row.employee_number,
      name: row.name,
      is_active: true,
      import_run_id: importRunId,
      updated_at: now,
    }));

    const { error: upsertError } = await supabase
      .from("employees")
      .upsert(toUpsert, { onConflict: "org_id,employee_number" });

    if (upsertError) {
      rowsFailed = rows.length;
      errors.push({ rowIndex: 0, message: upsertError.message });
    } else {
      rowsImported = rows.length;
    }

    if (deactivateNotInFile && employeeNumbersInFile.size > 0) {
      const keepList = Array.from(employeeNumbersInFile);
      const { data: toDeactivate } = await supabase
        .from("employees")
        .select("id")
        .eq("org_id", activeOrgId)
        .not("employee_number", "in", keepList);
      const ids = (toDeactivate ?? []).map((r: { id: string }) => r.id);
      if (ids.length > 0) {
        const { error: deactivateError } = await supabase
          .from("employees")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("id", ids);
        if (deactivateError) {
          console.error("[import/employees/apply] deactivate", deactivateError);
        }
      }
    }

    const errorReport = errors.length > 0 ? { errors } : null;

    const { error: updateRunError } = await supabase
      .from("employee_import_runs")
      .update({
        employee_count: rowsImported,
        rows_imported: rowsImported,
        rows_failed: rowsFailed,
        error_report: errorReport,
      })
      .eq("id", importRunId);

    if (updateRunError) {
      console.error("[import/employees/apply] run update", updateRunError);
    }

    const res = NextResponse.json({
      success: true,
      importRunId,
      summary: {
        rowsImported,
        rowsFailed,
        deactivated: deactivateNotInFile ? "org employees not in file" : null,
      },
      errors: errors.length > 0 ? errors : undefined,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[import/employees/apply]", err);
    return NextResponse.json({ error: "Apply import failed" }, { status: 500 });
  }
}
