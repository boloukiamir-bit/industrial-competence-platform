/**
 * POST /api/hr/jobs/[id]/status — transition job status. Admin/HR only.
 * Body: { to_status: "SENT" | "SIGNED" | "COMPLETED" | "CANCELLED", note?: string }
 * Allowed: CREATED→SENT|CANCELLED; SENT→SIGNED|CANCELLED; SIGNED→COMPLETED.
 */
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
import { requireAdminOrHr } from "@/lib/server/requireAdminOrHr";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ALLOWED: Record<string, string[]> = {
  CREATED: ["SENT", "CANCELLED"],
  SENT: ["SIGNED", "CANCELLED"],
  SIGNED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export async function POST(
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

  let body: { to_status?: string; note?: string };
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const toStatus = typeof body.to_status === "string" ? body.to_status.trim().toUpperCase() : "";
  const note = typeof body.note === "string" ? body.note.trim() : null;
  const validTo = ["SENT", "SIGNED", "COMPLETED", "CANCELLED"];
  if (!toStatus || !validTo.includes(toStatus)) {
    const res = NextResponse.json(
      { error: "to_status must be one of: SENT, SIGNED, COMPLETED, CANCELLED" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const jobResult = await pool.query(
      `SELECT id, status FROM hr_jobs WHERE id = $1 AND org_id = $2`,
      [id.trim(), auth.activeOrgId]
    );
    const job = jobResult.rows[0];
    if (!job) {
      const res = NextResponse.json({ error: "Job not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const fromStatus = (job.status ?? "CREATED").toUpperCase();
    const allowed = ALLOWED[fromStatus];
    if (!allowed?.includes(toStatus)) {
      const res = NextResponse.json(
        { error: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed from ${fromStatus}: ${allowed?.join(", ") ?? "none"}.` },
        { status: 400 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    await pool.query(
      `UPDATE hr_jobs SET status = $1, updated_at = now() WHERE id = $2 AND org_id = $3`,
      [toStatus, id.trim(), auth.activeOrgId]
    );

    await pool.query(
      `INSERT INTO hr_job_events (org_id, job_id, event_type, from_status, to_status, actor_user_id, actor_email, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        auth.activeOrgId,
        id.trim(),
        toStatus,
        fromStatus,
        toStatus,
        auth.userId,
        auth.userEmail ?? null,
        note,
      ]
    );

    const res = NextResponse.json({ ok: true, status: toStatus });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/hr/jobs/[id]/status failed:", msg);
    const res = NextResponse.json({ error: msg }, { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
