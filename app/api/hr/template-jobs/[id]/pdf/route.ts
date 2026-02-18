/**
 * GET /api/hr/template-jobs/[id]/pdf — downloadable PDF for job.
 * Server-only: pdf-lib, no React. RLS via org_id.
 */
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { pool } from "@/lib/db/pool";
import { getDefaultNotesForTemplate, renderNotes } from "@/lib/hr/templateRender";
import type { PlaceholderContext } from "@/lib/hr/templateRender";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MARGIN = 50;
const LINE_HEIGHT = 14;
const FONT_SIZE = 10;
const FONT_SIZE_TITLE = 14;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json({ ok: false, error: org.error }, { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
  const { id } = await params;
  try {
    const result = await pool.query(
      `SELECT j.template_code, j.status, j.due_date, j.notes, j.filled_values, j.created_at,
              j.owner_user_id,
              e.name as employee_name, e.employee_number, e.line_code, e.line,
              t.name as template_name, t.content as template_content,
              o.name as org_name, s.name as site_name
       FROM hr_template_jobs j
       JOIN employees e ON e.id = j.employee_id AND e.org_id = j.org_id
       LEFT JOIN hr_templates t ON t.org_id = j.org_id AND t.code = j.template_code
       LEFT JOIN organizations o ON o.id = j.org_id
       LEFT JOIN sites s ON s.id = j.site_id
       WHERE j.id = $1 AND j.org_id = $2`,
      [id, org.activeOrgId]
    );
    const row = result.rows[0];
    if (!row) {
      const res = NextResponse.json({ ok: false, error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const templateName = row.template_name ?? row.template_code;
    const employeeName = row.employee_name ?? "";
    const employeeNumber = row.employee_number ?? "";
    const employeeLine = row.line ?? row.line_code ?? "";
    const orgName = row.org_name ?? "";
    const siteName = row.site_name ?? "";
    const dueDate = row.due_date ? String(row.due_date) : "";
    const createdAt = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : "";
    const today = new Date().toISOString().slice(0, 10);

    const context: PlaceholderContext = {
      employee_name: employeeName,
      employee_no: employeeNumber,
      employee_line: employeeLine,
      site_name: siteName,
      org_name: orgName,
      today,
      due_date: dueDate,
    };
    const rawNotes = getDefaultNotesForTemplate(row.template_code, row.template_content);
    const notesResolved = (row.notes && String(row.notes).trim()) || (rawNotes ? renderNotes(rawNotes, context) : "");

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();
    let y = height - MARGIN;

    page.drawText(templateName, {
      x: MARGIN,
      y,
      size: FONT_SIZE_TITLE,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= LINE_HEIGHT;

    page.drawText(`${row.template_code} • ${row.status}`, {
      x: MARGIN,
      y,
      size: 9,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= LINE_HEIGHT + 8;

    const block = (title: string, entries: [string, string][]) => {
      page.drawText(title, { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      y -= LINE_HEIGHT;
      for (const [label, value] of entries) {
        page.drawText(`${label}: `, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.4, 0.4, 0.4) });
        const labelW = font.widthOfTextAtSize(`${label}: `, FONT_SIZE);
        page.drawText(String(value || "—"), { x: MARGIN + labelW, y, size: FONT_SIZE, font });
        y -= LINE_HEIGHT;
      }
      y -= 6;
    };

    block("Employee", [
      ["Name", employeeName],
      ["Employee number", employeeNumber],
      ["Line / Area", employeeLine],
    ]);

    block("Job", [
      ["Due date", dueDate],
      ["Created at", createdAt],
      ["Owner", row.owner_user_id ? String(row.owner_user_id) : "—"],
    ]);

    if (notesResolved) {
      page.drawText("Notes", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      y -= LINE_HEIGHT;
      const noteLines = notesResolved.split(/\n/);
      for (const line of noteLines) {
        if (y < MARGIN + 40) break;
        page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
        y -= LINE_HEIGHT;
      }
      y -= 6;
    }

    const sections = (row.template_content as { sections?: Array<{ title?: string; fields?: string[] }> })?.sections ?? [];
    const filledValues = (row.filled_values ?? {}) as Record<string, unknown>;
    const allFields = sections.flatMap((s) => (s.fields ?? []).filter((f, i, a) => a.indexOf(f) === i));
    if (allFields.length > 0) {
      page.drawText("Editable fields", { x: MARGIN, y, size: 9, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
      y -= LINE_HEIGHT;
      for (const field of allFields) {
        if (y < MARGIN + 40) break;
        const val = filledValues[field];
        page.drawText(`${field}: `, { x: MARGIN, y, size: FONT_SIZE, font, color: rgb(0.4, 0.4, 0.4) });
        const lw = font.widthOfTextAtSize(`${field}: `, FONT_SIZE);
        page.drawText(String(val ?? "—"), { x: MARGIN + lw, y, size: FONT_SIZE, font });
        y -= LINE_HEIGHT;
      }
    }

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    const filename = `JOB_${row.template_code}_${employeeNumber || id}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const res = new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (e) {
    console.error("[template-jobs] PDF error", e);
    const res = NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to generate PDF" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
