/**
 * POST /api/compliance/employee/bulk-upsert — bulk update employee compliance. Admin/HR only (waive = admin only).
 * Body: { employee_ids: string[], compliance_code?: string, primary_blocker?: boolean, patch: { valid_to?, evidence_url?, waived?, notesMerge? } }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

type NotesMerge = {
  owner?: string;
  dueDate?: string;
  waivedReason?: string;
};

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return undefined;
}

function normalizeNotesMerge(value: unknown): NotesMerge | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  const owner = typeof payload.owner === "string" && payload.owner.trim() ? payload.owner.trim() : null;
  const dueDate = typeof payload.dueDate === "string" && payload.dueDate.trim() ? payload.dueDate.trim() : null;
  const waivedReason =
    typeof payload.waivedReason === "string" && payload.waivedReason.trim()
      ? payload.waivedReason.trim()
      : null;
  if (!owner && !dueDate && !waivedReason) return null;
  return {
    ...(owner ? { owner } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(waivedReason ? { waivedReason } : {}),
  };
}

function mergeNotes(existingNotes: string | null, merge: NotesMerge): string | null {
  const trimmed = existingNotes?.trim();
  let payload: Record<string, unknown> = {};
  let fromJson = false;
  let rawText: string | null = null;

  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        payload = { ...(parsed as Record<string, unknown>) };
        fromJson = true;
      } else {
        rawText = trimmed;
      }
    } catch {
      rawText = trimmed;
    }
  }

  if (!fromJson && rawText) {
    payload = { text: rawText };
  }

  if (merge.owner) payload.owner = merge.owner;
  if (merge.dueDate) payload.dueDate = merge.dueDate;
  if (merge.waivedReason) payload.waivedReason = merge.waivedReason;

  if (Object.keys(payload).length === 0) return rawText || null;
  return JSON.stringify(payload);
}

export async function POST(request: NextRequest) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const org = await getActiveOrgFromSession(request, supabase);
  if (!org.ok) {
    const res = NextResponse.json(errorPayload("getActiveOrg", org.error), { status: org.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("user_id", org.userId)
    .eq("org_id", org.activeOrgId)
    .eq("status", "active")
    .maybeSingle();

  if (!isHrAdmin(membership?.role)) {
    const res = NextResponse.json(
      { ok: false as const, step: "forbidden", error: "Admin or HR role required" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const isAdmin = (membership?.role ?? "").toLowerCase() === "admin";

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    const res = NextResponse.json(errorPayload("body", "Invalid JSON"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const rawEmployeeIds = Array.isArray(body.employee_ids) ? body.employee_ids : [];
  const employee_ids = rawEmployeeIds
    .filter((id): id is string => typeof id === "string")
    .map((id) => id.trim())
    .filter(Boolean);
  if (employee_ids.length === 0) {
    const res = NextResponse.json(errorPayload("validation", "employee_ids is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const compliance_code = typeof body.compliance_code === "string" ? body.compliance_code.trim() : "";
  const primary_blocker =
    body.primary_blocker === true || body.target === "primary_blocker" || compliance_code === "PRIMARY_BLOCKER";

  const patch = typeof body.patch === "object" && body.patch !== null ? (body.patch as Record<string, unknown>) : {};
  const valid_to = normalizeOptionalString(patch.valid_to);
  const evidence_url = normalizeOptionalString(patch.evidence_url);
  const waived = typeof patch.waived === "boolean" ? patch.waived : undefined;
  const notesMerge = normalizeNotesMerge(patch.notesMerge);

  if (waived !== undefined && !isAdmin) {
    const res = NextResponse.json(
      { ok: false as const, step: "forbidden", error: "Admin role required to waive" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (notesMerge?.waivedReason && !isAdmin) {
    const res = NextResponse.json(
      { ok: false as const, step: "forbidden", error: "Admin role required to waive" },
      { status: 403 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (waived === true && !notesMerge?.waivedReason) {
    const res = NextResponse.json(errorPayload("validation", "waivedReason is required when waiving"), {
      status: 400,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (!primary_blocker && !compliance_code) {
    const res = NextResponse.json(errorPayload("validation", "compliance_code is required"), { status: 400 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  if (valid_to === undefined && evidence_url === undefined && waived === undefined && !notesMerge) {
    const res = NextResponse.json(errorPayload("validation", "At least one patch field is required"), {
      status: 400,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    let employeesQuery = supabaseAdmin
      .from("employees")
      .select("id, site_id")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("id", employee_ids);
    if (activeSiteId) {
      employeesQuery = employeesQuery.or(`site_id.eq.${activeSiteId},site_id.is.null`);
    }
    const { data: employeeRows, error: employeeErr } = await employeesQuery;
    if (employeeErr) {
      const res = NextResponse.json(errorPayload("employees", employeeErr.message, employeeErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const employeeSiteById = new Map<string, string | null>();
    for (const row of employeeRows ?? []) {
      employeeSiteById.set(row.id, row.site_id ?? null);
    }

    const targetByEmployee = new Map<string, string>();
    if (primary_blocker) {
      let blockersQuery = supabaseAdmin
        .from("v_employee_compliance_blockers_pilot")
        .select("employee_id, compliance_code, valid_to")
        .eq("org_id", orgId)
        .in("employee_id", employee_ids);
      if (activeSiteId) {
        blockersQuery = blockersQuery.or(`site_id.eq.${activeSiteId},site_id.is.null`);
      }
      const { data: blockerRows, error: blockerErr } = await blockersQuery;
      if (blockerErr) {
        const res = NextResponse.json(errorPayload("blockers", blockerErr.message, blockerErr.details ?? undefined), {
          status: 500,
        });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      const primaryByEmployee = new Map<string, { compliance_code: string; valid_to: string | null }>();
      for (const row of blockerRows ?? []) {
        const existing = primaryByEmployee.get(row.employee_id);
        if (!existing) {
          primaryByEmployee.set(row.employee_id, {
            compliance_code: row.compliance_code,
            valid_to: row.valid_to,
          });
          continue;
        }
        const existingDate = existing.valid_to ? new Date(existing.valid_to).getTime() : Infinity;
        const nextDate = row.valid_to ? new Date(row.valid_to).getTime() : Infinity;
        if (nextDate < existingDate) {
          primaryByEmployee.set(row.employee_id, {
            compliance_code: row.compliance_code,
            valid_to: row.valid_to,
          });
        }
      }

      for (const employeeId of employee_ids) {
        const primary = primaryByEmployee.get(employeeId);
        if (primary?.compliance_code) {
          targetByEmployee.set(employeeId, primary.compliance_code);
        }
      }
    } else if (compliance_code) {
      for (const employeeId of employee_ids) {
        targetByEmployee.set(employeeId, compliance_code);
      }
    }

    const codes = Array.from(new Set(targetByEmployee.values()));
    if (codes.length === 0) {
      const res = NextResponse.json(errorPayload("validation", "No target compliance codes found"), { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: catalogRows, error: catalogErr } = await supabaseAdmin
      .from("compliance_catalog")
      .select("id, code")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("code", codes);
    if (catalogErr) {
      const res = NextResponse.json(errorPayload("catalog", catalogErr.message, catalogErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const complianceIdByCode = new Map<string, string>();
    for (const row of catalogRows ?? []) {
      complianceIdByCode.set(row.code, row.id);
    }

    if (!primary_blocker && compliance_code && !complianceIdByCode.has(compliance_code)) {
      const res = NextResponse.json(errorPayload("catalog", "Compliance code not found or inactive"), {
        status: 404,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const complianceIds = Array.from(new Set(codes.map((code) => complianceIdByCode.get(code)).filter(Boolean)));
    const existingNotesByKey = new Map<string, string | null>();
    if (notesMerge && complianceIds.length > 0) {
      const { data: existingRows, error: existingErr } = await supabaseAdmin
        .from("employee_compliance")
        .select("employee_id, compliance_id, notes")
        .eq("org_id", orgId)
        .in("employee_id", employee_ids)
        .in("compliance_id", complianceIds as string[]);
      if (existingErr) {
        const res = NextResponse.json(errorPayload("notes", existingErr.message, existingErr.details ?? undefined), {
          status: 500,
        });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }

      for (const row of existingRows ?? []) {
        existingNotesByKey.set(`${row.employee_id}:${row.compliance_id}`, row.notes ?? null);
      }
    }

    const updatedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    let skipped = 0;

    for (const employeeId of employee_ids) {
      if (!employeeSiteById.has(employeeId)) {
        skipped += 1;
        continue;
      }
      const code = targetByEmployee.get(employeeId);
      const compliance_id = code ? complianceIdByCode.get(code) : undefined;
      if (!compliance_id) {
        skipped += 1;
        continue;
      }

      const row: Record<string, unknown> = {
        org_id: orgId,
        site_id: employeeSiteById.get(employeeId) ?? null,
        employee_id: employeeId,
        compliance_id,
        updated_at: updatedAt,
      };

      if (valid_to !== undefined) row.valid_to = valid_to;
      if (evidence_url !== undefined) row.evidence_url = evidence_url;
      if (waived !== undefined) row.waived = waived;

      if (notesMerge) {
        const existingNotes = existingNotesByKey.get(`${employeeId}:${compliance_id}`) ?? null;
        row.notes = mergeNotes(existingNotes, notesMerge);
      }

      rows.push(row);
    }

    if (rows.length === 0) {
      const res = NextResponse.json(errorPayload("validation", "No eligible employees to update"), { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { error: upsertErr } = await supabaseAdmin
      .from("employee_compliance")
      .upsert(rows, { onConflict: "org_id,employee_id,compliance_id", ignoreDuplicates: false });

    if (upsertErr) {
      console.error("compliance/employee/bulk-upsert", { step: "upsert", error: upsertErr });
      const res = NextResponse.json(errorPayload("upsert", upsertErr.message, upsertErr.details ?? undefined), {
        status: 500,
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const res = NextResponse.json({ ok: true, updated: rows.length, skipped });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("POST /api/compliance/employee/bulk-upsert failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
