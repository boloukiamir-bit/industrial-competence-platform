/**
 * GET /api/compliance/digest/export — P1.11 Weekly Compliance Digest export.
 * Admin/HR only (403 otherwise). Tenant: getActiveOrgFromSession.
 * Fetches overview data and returns CSV with bucket (critical/due7/due30).
 * No DB schema changes; reuses /api/compliance/overview via internal fetch.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { escapeCsvField } from "@/lib/csvEscape";
import { isHrAdmin } from "@/lib/auth";

function errorPayload(step: string, error: unknown, details?: string) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg, ...(details != null && { details }) };
}

type OverviewRow = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  site_id: string | null;
  site_name: string;
  compliance_id: string;
  compliance_code: string;
  compliance_name: string;
  category: string;
  status: string;
  valid_to: string | null;
  days_left: number | null;
};

type Bucket = "critical" | "due7" | "due30";

function bucketRow(row: OverviewRow): Bucket | null {
  if (row.status === "missing" || row.status === "expired") return "critical";
  if (row.status === "expiring" && row.days_left != null) {
    if (row.days_left >= 0 && row.days_left <= 7) return "due7";
    if (row.days_left >= 0 && row.days_left <= 30) return "due30";
  }
  return null;
}

const CSV_HEADERS = [
  "bucket",
  "employee_id",
  "employee_name",
  "employee_number",
  "compliance_code",
  "compliance_name",
  "category",
  "status",
  "days_left",
  "valid_to",
  "site_name",
  "line",
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

  try {
    const baseUrl = request.nextUrl.origin;
    const cookieHeader = request.headers.get("cookie") ?? "";
    const params = new URLSearchParams();
    if (org.activeSiteId) params.set("siteId", org.activeSiteId);
    const res = await fetch(`${baseUrl}/api/compliance/overview?${params}`, {
      headers: { cookie: cookieHeader },
    });
    const json = (await res.json()) as { ok?: boolean; rows?: OverviewRow[]; error?: string };
    if (!res.ok || !json.ok || !Array.isArray(json.rows)) {
      const err = json.error ?? "Failed to fetch overview";
      const out = NextResponse.json(errorPayload("overview", err), { status: 500 });
      applySupabaseCookies(out, pendingCookies);
      return out;
    }

    const rows: Array<{ bucket: Bucket; row: OverviewRow }> = [];
    for (const r of json.rows) {
      const b = bucketRow(r);
      if (b) rows.push({ bucket: b, row: r });
    }

    const csvRows: string[][] = [CSV_HEADERS as unknown as string[]];
    for (const { bucket, row } of rows) {
      csvRows.push([
        escapeCsvField(bucket),
        escapeCsvField(row.employee_id),
        escapeCsvField(row.employee_name),
        escapeCsvField(row.employee_number),
        escapeCsvField(row.compliance_code),
        escapeCsvField(row.compliance_name),
        escapeCsvField(row.category),
        escapeCsvField(row.status),
        escapeCsvField(row.days_left != null ? String(row.days_left) : ""),
        escapeCsvField(row.valid_to ?? ""),
        escapeCsvField(row.site_name ?? ""),
        escapeCsvField(row.line ?? ""),
      ]);
    }

    const csv = csvRows.map((r) => r.join(",")).join("\n");
    const out = new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="compliance-digest-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
    applySupabaseCookies(out, pendingCookies);
    return out;
  } catch (err) {
    console.error("GET /api/compliance/digest/export failed:", err);
    const res = NextResponse.json(errorPayload("unexpected", err), { status: 500 });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }
}
