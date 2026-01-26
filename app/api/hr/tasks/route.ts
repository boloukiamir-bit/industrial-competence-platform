import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type ExpiringTask = {
  id: string;
  employee_id: string;
  employee_name: string | null;
  type: "medical" | "cert";
  item_name: string;
  expires_on: string;
  days_to_expiry: number;
  severity: "P0" | "P1" | "P2";
};

export async function GET(request: NextRequest) {
  try {
    // Authenticate and get org session
    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const session = await getOrgIdFromSession(request, supabase);
    if (!session.success) {
      const res = NextResponse.json({ error: session.error }, { status: session.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    // Verify user has access to HR tasks (admin or hr role)
    if (session.role !== "admin" && session.role !== "hr") {
      const res = NextResponse.json({ error: "Forbidden: HR admin access required" }, { status: 403 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const orgId = session.orgId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const todayStr = today.toISOString().slice(0, 10);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    const tasks: ExpiringTask[] = [];

    // Fetch expiring medical checks from person_events
    // First get employee IDs for this org
    const { data: orgEmployees, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("org_id", orgId)
      .eq("is_active", true);

    if (empError) {
      console.error("Error fetching employees:", empError);
    }

    const employeeIds = (orgEmployees || []).map((e: { id: string }) => e.id);
    
    if (employeeIds.length === 0) {
      const res = NextResponse.json({
        tasks: [],
        meta: { medical_count: 0, cert_count: 0, total_count: 0 },
      });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: medicalEvents, error: medicalError } = await supabaseAdmin
      .from("person_events")
      .select(`
        id,
        employee_id,
        title,
        due_date,
        employees:employee_id (
          id,
          name
        )
      `)
      .eq("category", "medical_check")
      .is("completed_date", null)
      .lte("due_date", thirtyDaysStr)
      .in("employee_id", employeeIds);

    if (medicalError) {
      console.error("Error fetching medical events:", medicalError);
    } else if (medicalEvents) {
      for (const event of medicalEvents) {
        const employeeData = event.employees;
        const employee = Array.isArray(employeeData) ? employeeData[0] : employeeData;
        if (!employee) continue;
        const emp = employee as { id: string; name: string | null };

        const dueDate = new Date(event.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let severity: "P0" | "P1" | "P2";
        if (daysDiff < 0) {
          severity = "P0";
        } else if (daysDiff <= 7) {
          severity = "P1";
        } else {
          severity = "P2";
        }

        tasks.push({
          id: event.id,
          employee_id: event.employee_id,
          employee_name: emp.name,
          type: "medical",
          item_name: event.title,
          expires_on: event.due_date,
          days_to_expiry: daysDiff,
          severity,
        });
      }
    }

    // Fetch expiring certificates from documents
    const { data: certs, error: certError } = await supabaseAdmin
      .from("documents")
      .select(`
        id,
        employee_id,
        title,
        valid_to,
        employees:employee_id (
          id,
          name
        )
      `)
      .eq("type", "certificate")
      .not("valid_to", "is", null)
      .lte("valid_to", thirtyDaysStr)
      .in("employee_id", employeeIds);

    if (certError) {
      console.error("Error fetching certificates:", certError);
    } else if (certs) {
      for (const cert of certs) {
        const employeeData = cert.employees;
        const employee = Array.isArray(employeeData) ? employeeData[0] : employeeData;
        if (!employee) continue;
        const emp = employee as { id: string; name: string | null };

        const expiryDate = new Date(cert.valid_to);
        expiryDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        let severity: "P0" | "P1" | "P2";
        if (daysDiff < 0) {
          severity = "P0";
        } else if (daysDiff <= 7) {
          severity = "P1";
        } else {
          severity = "P2";
        }

        tasks.push({
          id: cert.id,
          employee_id: cert.employee_id,
          employee_name: emp.name,
          type: "cert",
          item_name: cert.title,
          expires_on: cert.valid_to,
          days_to_expiry: daysDiff,
          severity,
        });
      }
    }

    // Sort by severity (P0 first) then by days_to_expiry (most urgent first)
    tasks.sort((a, b) => {
      const severityOrder = { P0: 0, P1: 1, P2: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.days_to_expiry - b.days_to_expiry;
    });

    const medicalCount = tasks.filter((t) => t.type === "medical").length;
    const certCount = tasks.filter((t) => t.type === "cert").length;

    const res = NextResponse.json({
      tasks,
      meta: {
        medical_count: medicalCount,
        cert_count: certCount,
        total_count: tasks.length,
      },
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("HR Tasks API error:", err);
    const errorMessage = err instanceof Error ? err.message : "Failed to fetch HR tasks";
    const res = NextResponse.json({ error: errorMessage }, { status: 500 });
    try {
      const { pendingCookies } = await createSupabaseServerClient();
      applySupabaseCookies(res, pendingCookies);
    } catch {
      // Ignore cookie errors on error path
    }
    return res;
  }
}
