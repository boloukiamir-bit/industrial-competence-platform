/**
 * GET /api/onboarding/templates/[type] — download CSV template for onboarding.
 * Types: areas, stations, employees, shift-patterns.
 * Authenticated org member only (tenant-scoped by session).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import {
  getOnboardingTemplateCsv,
  isOnboardingTemplateType,
} from "@/lib/onboarding/csvTemplates";

const FILENAME: Record<string, string> = {
  areas: "areas.csv",
  stations: "stations.csv",
  employees: "employees.csv",
  "shift-patterns": "shift_patterns.csv",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { supabase, pendingCookies } = await createSupabaseServerClient();
  const session = await getOrgIdFromSession(request, supabase);
  if (!session.success) {
    const res = NextResponse.json({ error: session.error }, { status: session.status });
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const { type } = await params;
  if (!isOnboardingTemplateType(type)) {
    const res = NextResponse.json(
      { error: "Unknown template type. Use: areas, stations, employees, shift-patterns" },
      { status: 400 }
    );
    applySupabaseCookies(res, pendingCookies);
    return res;
  }

  const csv = getOnboardingTemplateCsv(type);
  const filename = FILENAME[type] ?? `${type}.csv`;

  const res = new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
  applySupabaseCookies(res, pendingCookies);
  return res;
}
