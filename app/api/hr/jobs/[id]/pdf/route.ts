/**
 * GET /api/hr/jobs/[id]/pdf — generate PDF for an HR job. Admin/HR only.
 * Returns application/pdf with: job title, employee name + number, date created, rendered body.
 * No React; pure Node + pdf-lib to avoid render context crashes.
 */
import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { pool } from "@/lib/db/pool";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const LINE_HEIGHT = 14;
const MARGIN = 50;
const FONT_SIZE_BODY = 11;
const FONT_SIZE_HEADER = 12;
const CHARS_PER_LINE = 85;

function wrapLines(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const p of paragraphs) {
    let rest = p;
    while (rest.length > 0) {
      if (rest.length <= maxChars) {
        lines.push(rest);
        break;
      }
      let split = rest.slice(0, maxChars);
      const lastSpace = split.lastIndexOf(" ");
      if (lastSpace > maxChars >> 1) {
        split = split.slice(0, lastSpace);
        rest = rest.slice(lastSpace + 1);
      } else {
        rest = rest.slice(maxChars);
      }
      lines.push(split);
    }
  }
  return lines;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const auth = await requireAdminOrHr(request, supabase);
  if (!auth.ok) {
    const res = NextResponse.json({ error: auth.error }, { status: auth.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { id } = await params;
  if (!id?.trim()) {
    const res = NextResponse.json({ error: "Job id required" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const result = await pool.query(
      `SELECT j.id, j.title, j.rendered_body, j.created_at,
              e.name AS employee_name, e.first_name, e.last_name, e.employee_number
       FROM hr_jobs j
       JOIN employees e ON e.id = j.employee_id
       WHERE j.id = $1 AND j.org_id = $2`,
      [id.trim(), auth.activeOrgId]
    );

    const row = result.rows[0];
    if (!row) {
      const res = NextResponse.json({ error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const title = String(row.title ?? "HR Job").trim();
    const employeeName =
      row.employee_name ?? ([row.first_name, row.last_name].filter(Boolean).join(" ") || "—");
    const employeeNumber = String(row.employee_number ?? "").trim();
    const dateCreated = row.created_at
      ? new Date(row.created_at).toLocaleDateString("en-CA", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "—";
    const bodyText = String(row.rendered_body ?? "").trim();

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    let page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();
    let y = height - MARGIN;

    const drawText = (
      text: string,
      opts: { font?: typeof font; size?: number; color?: ReturnType<typeof rgb> } = {}
    ) => {
      const f = opts.font ?? font;
      const size = opts.size ?? FONT_SIZE_BODY;
      const color = opts.color ?? rgb(0, 0, 0);
      page.drawText(text, { x: MARGIN, y, font: f, size, color });
      y -= size + 2;
    };

    drawText(title, { font: fontBold, size: FONT_SIZE_HEADER + 2 });
    y -= 4;
    drawText(`Employee: ${employeeName}${employeeNumber ? ` (${employeeNumber})` : ""}`);
    drawText(`Date created: ${dateCreated}`);
    y -= 8;

    const bodyLines = wrapLines(bodyText, CHARS_PER_LINE);
    for (const line of bodyLines) {
      if (y < MARGIN + LINE_HEIGHT) {
        page = pdfDoc.addPage([595, 842]);
        y = page.getHeight() - MARGIN;
      }
      page.drawText(line, { x: MARGIN, y, font, size: FONT_SIZE_BODY, color: rgb(0, 0, 0) });
      y -= LINE_HEIGHT;
    }

    const pdfBytes = await pdfDoc.save();

    await pool.query(
      `INSERT INTO hr_job_events (org_id, job_id, event_type, actor_user_id, actor_email)
       VALUES ($1, $2, 'PDF_GENERATED', $3, $4)`,
      [auth.activeOrgId, id.trim(), auth.userId, auth.userEmail ?? null]
    );

    const res = new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="hr-job-${id.slice(0, 8)}.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/hr/jobs/[id]/pdf failed:", msg);
    const res = NextResponse.json({ error: msg }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
