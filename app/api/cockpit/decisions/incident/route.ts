/**
 * POST /api/cockpit/decisions/incident — log an incident decision (SHIFT mode).
 * Auth: getActiveOrgFromSession. Idempotent by target_id (sha256 of idempotency key).
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { normalizeShiftParam } from "@/lib/server/normalizeShift";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DECISION_TYPES = ["ACKNOWLEDGE", "OVERRIDE", "ESCALATE"] as const;
const DB_DECISION_TYPE_MAP: Record<string, string> = {
  ACKNOWLEDGE: "ACKNOWLEDGED",
  OVERRIDE: "OVERRIDDEN",
  ESCALATE: "escalate",
};
const SHIFT_CODES = ["Day", "Evening", "Night"] as const;

type IssuePayload = {
  type?: string;
  issue_type?: string;
  station_id?: string;
  station_code?: string;
  employee_id?: string;
  employee_name?: string;
  reason_code?: string;
  [k: string]: unknown;
};

function buildIdempotencyKey(
  date: string,
  shiftCode: string,
  issue: IssuePayload
): string {
  const type = (issue.type ?? issue.issue_type ?? "UNKNOWN").toString().trim();
  const station = (issue.station_id ?? issue.station_code ?? "NA").toString().trim();
  const employee = (issue.employee_id ?? issue.employee_name ?? "NA").toString().trim();
  const reasonCode = (issue.reason_code ?? "NA").toString().trim();
  return `INCIDENT_DECISION:${date}:${shiftCode}:${type}:${station}:${employee}:${reasonCode}`;
}

function sha256ToTargetId(idempotencyKey: string): string {
  const hash = createHash("sha256").update(idempotencyKey).digest();
  const bytes = Array.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient(request);
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(
      { ok: false, error: org.error },
      { status: org.status }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const decisionTypeRaw = typeof body.decision_type === "string" ? body.decision_type.trim().toUpperCase() : "";
  const decisionType = DECISION_TYPES.includes(decisionTypeRaw as (typeof DECISION_TYPES)[number])
    ? decisionTypeRaw
    : null;
  if (!decisionType) {
    const res = NextResponse.json(
      { ok: false, error: "decision_type must be one of ACKNOWLEDGE, OVERRIDE, ESCALATE" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    const res = NextResponse.json(
      { ok: false, error: "reason is required and must be non-empty" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const dateRaw = typeof body.date === "string" ? body.date.trim().slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const res = NextResponse.json(
      { ok: false, error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const shiftCodeRaw = typeof body.shift_code === "string" ? body.shift_code.trim() : "";
  const shiftCode = SHIFT_CODES.includes(shiftCodeRaw as (typeof SHIFT_CODES)[number])
    ? shiftCodeRaw
    : normalizeShiftParam(shiftCodeRaw) || null;
  if (!shiftCode) {
    const res = NextResponse.json(
      { ok: false, error: "shift_code must be Day, Evening, or Night" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const issue = body.issue && typeof body.issue === "object" ? (body.issue as IssuePayload) : null;
  if (!issue) {
    const res = NextResponse.json(
      { ok: false, error: "issue object is required" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const idempotencyKey = buildIdempotencyKey(dateRaw, shiftCode, issue);
  const target_id = sha256ToTargetId(idempotencyKey);
  const dbDecisionType = DB_DECISION_TYPE_MAP[decisionType] ?? "ACKNOWLEDGED";

  const root_cause = {
    type: "cockpit_incident",
    issue,
    decision: { type: decisionType },
    shift_date: dateRaw,
    shift_code: shiftCode,
    line: "all",
  };
  const row = {
    org_id: org.activeOrgId,
    site_id: org.activeSiteId ?? null,
    decision_type: dbDecisionType,
    target_type: "station_shift" as const,
    target_id,
    reason,
    root_cause,
    status: "active",
    created_by: org.userId,
  };

  try {
    const { data: existing } = await supabaseAdmin
      .from("execution_decisions")
      .select("id, target_id")
      .eq("org_id", org.activeOrgId)
      .eq("target_type", "station_shift")
      .eq("target_id", target_id)
      .maybeSingle();

    if (existing) {
      const res = NextResponse.json({
        ok: true,
        decision_id: existing.id,
        target_id: existing.target_id,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("execution_decisions")
      .insert(row as Record<string, unknown>)
      .select("id, target_id")
      .single();

    if (error) {
      if ((error as { code?: string }).code === "23505") {
        const res = NextResponse.json({
          ok: true,
          decision_id: null,
          target_id,
        });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
      console.error("[cockpit/decisions/incident] insert error:", error);
      const res = NextResponse.json(
        { ok: false, error: "Failed to save decision" },
        { status: 500 }
      );
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({
      ok: true,
      decision_id: inserted?.id,
      target_id: inserted?.target_id ?? target_id,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[cockpit/decisions/incident] error:", err);
    const res = NextResponse.json(
      { ok: false, error: "Failed to save decision" },
      { status: 500 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
