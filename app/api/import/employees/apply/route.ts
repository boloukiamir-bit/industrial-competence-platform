/**
 * POST /api/import/employees/apply
 * Upserts employees from validated rows; org_id/site_id from active_org_id/active_site_id only.
 * Optionally deactivates org employees not in the file.
 * Creates employee_import_runs record with stats and error report.
 * All writes use user-scoped client so RLS is enforced.
 * Governed via withMutationGovernance (allowNoShiftContext: true).
 */
import { NextResponse } from "next/server";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

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

export const POST = withMutationGovernance(
  async (ctx) => {
    try {
      const { rows, deactivateNotInFile } = parseBody(ctx.body);

      if (rows.length === 0) {
        return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
      }

      const employeeNumbersInFile = new Set(rows.map((r) => r.employee_number));
      const errors: Array<{ rowIndex: number; message: string }> = [];
      let rowsImported = 0;
      let rowsFailed = 0;

      const { data: runRow, error: runInsertError } = await ctx.supabase
        .from("employee_import_runs")
        .insert({
          organization_id: ctx.orgId,
          site_id: ctx.siteId,
          created_by: ctx.userId,
          employee_count: 0,
          rows_imported: 0,
          rows_failed: 0,
          error_report: null,
        })
        .select("id")
        .single();

      if (runInsertError || !runRow?.id) {
        console.error("[import/employees/apply] run insert", runInsertError);
        return NextResponse.json({ error: "Failed to create import run" }, { status: 500 });
      }

      const importRunId = runRow.id;
      const now = new Date().toISOString();
      const toUpsert = rows.map((row) => ({
        org_id: ctx.orgId,
        employee_number: row.employee_number,
        name: row.name,
        is_active: true,
        import_run_id: importRunId,
        updated_at: now,
      }));

      const { error: upsertError } = await ctx.supabase
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
        const { data: toDeactivate } = await ctx.supabase
          .from("employees")
          .select("id")
          .eq("org_id", ctx.orgId)
          .not("employee_number", "in", keepList);
        const ids = (toDeactivate ?? []).map((r: { id: string }) => r.id);
        if (ids.length > 0) {
          const { error: deactivateError } = await ctx.supabase
            .from("employees")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .in("id", ids);
          if (deactivateError) {
            console.error("[import/employees/apply] deactivate", deactivateError);
          }
        }
      }

      const errorReport = errors.length > 0 ? { errors } : null;

      const { error: updateRunError } = await ctx.supabase
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

      return NextResponse.json({
        success: true,
        importRunId,
        summary: {
          rowsImported,
          rowsFailed,
          deactivated: deactivateNotInFile ? "org employees not in file" : null,
        },
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (err) {
      console.error("[import/employees/apply]", err);
      return NextResponse.json({ error: "Apply import failed" }, { status: 500 });
    }
  },
  {
    route: "/api/import/employees/apply",
    action: "IMPORT_EMPLOYEES_APPLY",
    target_type: "org",
    allowNoShiftContext: true,
    getTargetIdAndMeta: () => ({ target_id: "import_run", meta: {} }),
  }
);
