/**
 * GET /api/compliance/actions/export — P1.7 Notifications Export Pack.
 * Admin/HR only. Tenant: getActiveOrgFromSession. Site: strict when activeSiteId set.
 * Query: status (default open), sla, actionType, category, line, q, owner, limit (default 500, max 2000), channel (default email).
 * Returns CSV with draft subject/body and evidence columns.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { getActiveSiteName } from "@/lib/server/siteName";
import {
  type ComplianceStatusFlag,
  complianceDaysLeft,
  computeComplianceStatus,
} from "@/lib/server/complianceStatus";
import { renderDraftForAction } from "@/lib/server/complianceDraftRender";
import { escapeCsvField } from "@/lib/csvEscape";
import { isHrAdmin } from "@/lib/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ACTION_TYPES = ["request_renewal", "request_evidence", "notify_employee", "mark_waived_review"] as const;
const CATEGORIES = ["license", "medical", "contract"] as const;
const CHANNELS = ["email", "sms", "note"] as const;

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

const CSV_HEADERS = [
  "action_id",
  "employee_id",
  "employee_number",
  "employee_name",
  "compliance_code",
  "compliance_name",
  "status",
  "days_left",
  "valid_to",
  "site_name",
  "line",
  "action_type",
  "channel",
  "due_date",
  "owner_email",
  "last_drafted_at",
  "evidence_url",
  "evidence_notes",
  "subject",
  "body",
  "template_status",
  "evidence_status",
] as const;

export async function GET(request: NextRequest) {
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
    const res = NextResponse.json(errorPayload("forbidden", "Admin/HR only"), { status: 403 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { searchParams } = new URL(request.url);
  const statusParam = (searchParams.get("status")?.trim() || "open") as "open" | "done" | "all";
  const q = searchParams.get("q")?.trim() || null;
  const actionTypeParam = searchParams.get("actionType")?.trim() || "all";
  const dueParam = (searchParams.get("due")?.trim() || "all") as "overdue" | "7d" | "30d" | "all";
  const line = searchParams.get("line")?.trim() || null;
  const categoryParam = (searchParams.get("category")?.trim() || "all") as "license" | "medical" | "contract" | "all";
  const unassignedOnly = searchParams.get("unassignedOnly") === "1";
  const slaParam = (searchParams.get("sla")?.trim() || "all") as "overdue" | "due7d" | "nodue" | "all";
  const ownerParam = (searchParams.get("owner")?.trim() || "all") as "me" | "unassigned" | "all";
  const complianceStatusParam = (searchParams.get("complianceStatus")?.trim() || "all") as "all" | "missing_expired" | "expiring" | "waived";
  const limitParam = searchParams.get("limit");
  const limit =
    limitParam != null
      ? Math.min(2000, Math.max(1, parseInt(limitParam, 10) || 500))
      : 500;
  const channelParam = (searchParams.get("channel")?.trim() || "email") as "email" | "sms" | "note";
  const channel = CHANNELS.includes(channelParam) ? channelParam : "email";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().slice(0, 10);
  const in30 = new Date(today);
  in30.setDate(in30.getDate() + 30);
  const in30Str = in30.toISOString().slice(0, 10);

  try {
    const orgId = org.activeOrgId;
    const activeSiteId = org.activeSiteId ?? null;

    let actionsQuery = supabaseAdmin
      .from("compliance_actions")
      .select(
        "id, org_id, site_id, employee_id, compliance_id, action_type, status, due_date, owner_user_id, evidence_url, evidence_notes, evidence_added_at, created_at"
      )
      .eq("org_id", orgId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (activeSiteId) {
      actionsQuery = actionsQuery.eq("site_id", activeSiteId);
    }

    if (slaParam !== "all") {
      actionsQuery = actionsQuery.eq("status", "open");
      if (slaParam === "overdue") {
        actionsQuery = actionsQuery.not("due_date", "is", null).lt("due_date", todayStr);
      } else if (slaParam === "due7d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in7Str);
      } else if (slaParam === "nodue") {
        actionsQuery = actionsQuery.is("due_date", null);
      }
    } else {
      if (statusParam === "open") {
        actionsQuery = actionsQuery.eq("status", "open");
      } else if (statusParam === "done") {
        actionsQuery = actionsQuery.eq("status", "done");
      }
    }

    if (actionTypeParam !== "all" && ACTION_TYPES.includes(actionTypeParam as (typeof ACTION_TYPES)[number])) {
      actionsQuery = actionsQuery.eq("action_type", actionTypeParam);
    }

    if (slaParam === "all") {
      if (dueParam === "overdue") {
        actionsQuery = actionsQuery.not("due_date", "is", null).lt("due_date", todayStr);
      } else if (dueParam === "7d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in7Str);
      } else if (dueParam === "30d") {
        actionsQuery = actionsQuery
          .not("due_date", "is", null)
          .gte("due_date", todayStr)
          .lte("due_date", in30Str);
      }
    }

    if (ownerParam === "me") {
      actionsQuery = actionsQuery.eq("owner_user_id", org.userId);
    } else if (ownerParam === "unassigned" || unassignedOnly) {
      actionsQuery = actionsQuery.is("owner_user_id", null);
    }

    const { data: actionRows, error: actionsErr } = await actionsQuery;

    if (actionsErr) {
      console.error("compliance/actions/export list", actionsErr);
      const res = NextResponse.json(errorPayload("list", actionsErr.message), { status: 500 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const actions = actionRows ?? [];
    const employeeIds = [...new Set(actions.map((a: { employee_id: string }) => a.employee_id))];
    const complianceIds = [...new Set(actions.map((a: { compliance_id: string }) => a.compliance_id))];

    let employees: Array<{
      id: string;
      name: string;
      first_name?: string;
      last_name?: string;
      employee_number?: string;
      line?: string;
      site_id?: string;
    }> = [];
    if (employeeIds.length > 0) {
      let empQ = supabaseAdmin
        .from("employees")
        .select("id, name, first_name, last_name, employee_number, line, site_id")
        .eq("org_id", orgId)
        .in("id", employeeIds);
      if (activeSiteId) empQ = empQ.eq("site_id", activeSiteId);
      const { data: empRows } = await empQ;
      employees = empRows ?? [];
    }

    const empMap = new Map(
      employees.map((e) => [
        e.id,
        {
          name: e.name || [e.first_name, e.last_name].filter(Boolean).join(" ") || "—",
          employee_number: e.employee_number ?? "",
          line: e.line ?? null,
          site_id: e.site_id ?? null,
        },
      ])
    );

    let catalog: Array<{ id: string; code: string; name: string; category: string }> = [];
    if (complianceIds.length > 0) {
      let catQ = supabaseAdmin
        .from("compliance_catalog")
        .select("id, code, name, category")
        .eq("org_id", orgId)
        .in("id", complianceIds);
      if (categoryParam !== "all" && CATEGORIES.includes(categoryParam)) {
        catQ = catQ.eq("category", categoryParam);
      }
      const { data: catRows } = await catQ;
      catalog = catRows ?? [];
    }
    const catalogMap = new Map(catalog.map((c) => [c.id, c]));

    const actionIds = actions.map((a: { id: string }) => a.id);
    const latestDraftByAction = new Map<string, string>();
    if (actionIds.length > 0) {
      const { data: eventRows } = await supabaseAdmin
        .from("compliance_action_events")
        .select("action_id, created_at")
        .eq("org_id", orgId)
        .eq("event_type", "draft_copied")
        .in("action_id", actionIds)
        .order("created_at", { ascending: false });
      for (const e of eventRows ?? []) {
        if (!latestDraftByAction.has(e.action_id)) {
          latestDraftByAction.set(e.action_id, e.created_at ?? "");
        }
      }
    }

    let filtered = actions;
    if (q) {
      const qLower = q.toLowerCase();
      filtered = actions.filter((a: { employee_id: string }) => {
        const emp = empMap.get(a.employee_id);
        if (!emp) return false;
        return (
          emp.name.toLowerCase().includes(qLower) ||
          (emp.employee_number ?? "").toLowerCase().includes(qLower)
        );
      });
    }
    if (line) {
      filtered = filtered.filter((a: { employee_id: string }) => empMap.get(a.employee_id)?.line === line);
    }
    if (categoryParam !== "all") {
      filtered = filtered.filter(
        (a: { compliance_id: string }) => catalogMap.get(a.compliance_id)?.category === categoryParam
      );
    }

    // P1.9: compliance status for filter/sort — same as inbox
    const pairKeys = new Set(
      filtered.map((a: { employee_id: string; compliance_id: string }) => `${a.employee_id}:${a.compliance_id}`)
    );
    const ecMap = new Map<string, { valid_to: string | null; waived: boolean }>();
    if (pairKeys.size > 0) {
      const { data: ecRows } = await supabaseAdmin
        .from("employee_compliance")
        .select("employee_id, compliance_id, valid_to, waived")
        .eq("org_id", orgId);
      for (const r of ecRows ?? []) {
        const key = `${r.employee_id}:${r.compliance_id}`;
        if (pairKeys.has(key)) {
          ecMap.set(key, { valid_to: r.valid_to ?? null, waived: r.waived ?? false });
        }
      }
    }

    type EnrichedAction = (typeof filtered)[number] & {
      compliance_status: ComplianceStatusFlag;
      days_left: number | null;
      valid_to: string | null;
    };
    let enriched: EnrichedAction[] = (filtered as Array<Record<string, unknown>>).map((a) => {
      const key = `${a.employee_id}:${a.compliance_id}`;
      const ec = ecMap.get(key);
      const validTo = ec?.valid_to ?? null;
      const waived = ec?.waived ?? false;
      return {
        ...a,
        compliance_status: computeComplianceStatus(validTo, waived),
        days_left: complianceDaysLeft(validTo),
        valid_to: validTo,
      };
    }) as EnrichedAction[];

    if (complianceStatusParam === "missing_expired") {
      enriched = enriched.filter((r) => r.compliance_status === "expired" || r.compliance_status === "missing");
    } else if (complianceStatusParam === "expiring") {
      enriched = enriched.filter((r) => r.compliance_status === "expiring");
    } else if (complianceStatusParam === "waived") {
      enriched = enriched.filter((r) => r.compliance_status === "waived");
    }

    const complianceOrder = (s: ComplianceStatusFlag) =>
      s === "expired" ? 0 : s === "missing" ? 1 : s === "expiring" ? 2 : s === "waived" ? 3 : 4;
    enriched.sort((a, b) => {
      if (complianceOrder(a.compliance_status) !== complianceOrder(b.compliance_status)) {
        return complianceOrder(a.compliance_status) - complianceOrder(b.compliance_status);
      }
      if (a.compliance_status === "expiring" && b.compliance_status === "expiring") {
        const da = a.days_left;
        const db = b.days_left;
        if (da != null && db != null) return da - db;
        if (da != null) return -1;
        if (db != null) return 1;
      }
      const dueA = a.due_date ?? "";
      const dueB = b.due_date ?? "";
      if (dueA && dueB) return dueA.localeCompare(dueB);
      if (dueA) return -1;
      if (dueB) return 1;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });

    const siteNameMap = new Map<string, string>();
    if (!activeSiteId && enriched.length > 0) {
      const siteIds = [
        ...new Set(
          enriched.map((a: { site_id?: string }) => a.site_id).filter((v): v is string => Boolean(v))
        ),
      ];
      for (const sid of siteIds) {
        const name = await getActiveSiteName(supabaseAdmin, sid, orgId);
        siteNameMap.set(sid, name ?? "Unknown site");
      }
    }

    const activeSiteName =
      activeSiteId != null
        ? (await getActiveSiteName(supabaseAdmin, activeSiteId, orgId)) ?? "Unknown site"
        : null;

    const rows: string[][] = [];
    rows.push([...CSV_HEADERS]);

    for (const a of enriched) {
      const emp = empMap.get(a.employee_id);
      const cat = catalogMap.get(a.compliance_id);
      const siteId = a.site_id ?? null;
      const site_name =
        activeSiteName != null
          ? activeSiteName
          : siteId
            ? siteNameMap.get(siteId) ?? "Unknown site"
            : "";

      const draftInput = {
        action_type: a.action_type,
        due_date: a.due_date != null ? String(a.due_date).slice(0, 10) : null,
        site_id: siteId,
        employee_name: emp?.name ?? "—",
        employee_site_id: emp?.site_id ?? null,
        compliance_code: cat?.code ?? "",
        compliance_name: cat?.name ?? "",
        line: emp?.line ?? null,
      };
      const draft = await renderDraftForAction(
        supabaseAdmin,
        orgId,
        activeSiteId,
        draftInput,
        channel
      );

      const hasEvidence = Boolean(a.evidence_url || a.evidence_added_at);
      const owner_email = a.owner_user_id ? "HR" : "";

      rows.push([
        escapeCsvField(a.id),
        escapeCsvField(a.employee_id),
        escapeCsvField(emp?.employee_number ?? ""),
        escapeCsvField(emp?.name ?? ""),
        escapeCsvField(cat?.code ?? ""),
        escapeCsvField(cat?.name ?? ""),
        escapeCsvField(a.compliance_status),
        escapeCsvField(a.days_left != null ? String(a.days_left) : ""),
        escapeCsvField(a.valid_to ?? ""),
        escapeCsvField(site_name),
        escapeCsvField(emp?.line ?? ""),
        escapeCsvField(a.action_type),
        escapeCsvField(channel),
        escapeCsvField(a.due_date != null ? String(a.due_date).slice(0, 10) : ""),
        escapeCsvField(owner_email),
        escapeCsvField(latestDraftByAction.get(a.id) ?? ""),
        escapeCsvField(a.evidence_url ?? ""),
        escapeCsvField(a.evidence_notes ?? ""),
        escapeCsvField(draft.subject),
        escapeCsvField(draft.body),
        escapeCsvField(draft.template_status),
        escapeCsvField(hasEvidence ? "attached" : "none"),
      ]);
    }

    const csv = rows.map((row) => row.join(",")).join("\n");
    const res = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="compliance-actions-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("GET /api/compliance/actions/export failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
