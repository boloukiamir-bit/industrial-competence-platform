/**
 * GET /api/employees/[id]/profile — tenant-scoped by session (active_org_id).
 * Returns skills, events, documents, equipment, reviews, currentSalary, salaryRevisions, meetings,
 * and employeeProfile (rich profile row; empty object if missing).
 * PATCH — updates employee_profiles allowed fields; creates row if missing.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveOrgFromSession } from "@/lib/server/activeOrg";
import { createSupabaseServerClient, applySupabaseCookies } from "@/lib/supabase/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("id", id)
      .eq("org_id", org.activeOrgId)
      .maybeSingle();

    if (empError || !employee) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const [
      profileRowRes,
      skillsRes,
      eventsRes,
      docsRes,
      equipRes,
      reviewsRes,
      salaryRes,
      revisionsRes,
      meetingsRes,
    ] = await Promise.all([
      supabaseAdmin
        .from("employee_profiles")
        .select("*")
        .eq("employee_id", id)
        .maybeSingle(),
      supabaseAdmin
        .from("employee_skills")
        .select("*, skills(*)")
        .eq("employee_id", id),
      supabaseAdmin
        .from("person_events")
        .select("*")
        .eq("employee_id", id)
        .order("due_date"),
      supabaseAdmin
        .from("documents")
        .select("*")
        .eq("employee_id", id)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("employee_equipment")
        .select("*, equipment(*)")
        .eq("employee_id", id)
        .eq("status", "assigned"),
      supabaseAdmin
        .from("employee_reviews")
        .select("*, manager:manager_id(name), template:template_id(name)")
        .eq("employee_id", id)
        .order("review_date", { ascending: false }),
      supabaseAdmin
        .from("salary_records")
        .select("*")
        .eq("employee_id", id)
        .order("effective_from", { ascending: false })
        .limit(1),
      supabaseAdmin
        .from("salary_revisions")
        .select("*, manager:decided_by_manager_id(name)")
        .eq("employee_id", id)
        .order("revision_date", { ascending: false }),
      supabaseAdmin
        .from("one_to_one_meetings")
        .select("*, employee:employee_id(name), manager:manager_id(name)")
        .eq("employee_id", id)
        .order("scheduled_at", { ascending: false }),
    ]);

    const skills = (skillsRes.data || []).map((row: { employee_id: string; skill_id: string; level: number; skills: { name: string; code: string; category: string } | null }) => {
      const skill = row.skills;
      return {
        employeeId: row.employee_id,
        skillId: row.skill_id,
        level: row.level,
        skillName: skill?.name,
        skillCode: skill?.code,
        skillCategory: skill?.category,
      };
    });

    const events = (eventsRes.data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      employeeId: row.employee_id,
      category: row.category,
      title: row.title,
      description: row.description,
      dueDate: row.due_date,
      completedDate: row.completed_date,
      recurrence: row.recurrence,
      ownerManagerId: row.owner_manager_id,
      status: row.status,
      notes: row.notes,
    }));

    const documents = (docsRes.data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      employeeId: row.employee_id,
      title: row.title,
      type: row.type,
      url: row.url,
      createdAt: row.created_at,
      validTo: row.valid_to,
    }));

    const equipment = (equipRes.data || []).map((row: { id: string; employee_id: string; equipment_id: string; assigned_date: string; return_date?: string; status: string; equipment: { name: string; serial_number: string } | null }) => {
      const equip = row.equipment;
      return {
        id: row.id,
        employeeId: row.employee_id,
        equipmentId: row.equipment_id,
        equipmentName: equip?.name,
        serialNumber: equip?.serial_number,
        assignedDate: row.assigned_date,
        returnDate: row.return_date,
        status: row.status,
      };
    });

    const reviews = (reviewsRes.data || []).map((row: { id: string; employee_id: string; manager_id?: string; manager: { name: string } | null; template_id?: string; template: { name: string } | null } & Record<string, unknown>) => ({
      id: row.id,
      employeeId: row.employee_id,
      managerId: row.manager_id,
      managerName: row.manager?.name,
      templateId: row.template_id,
      templateName: row.template?.name,
      reviewDate: row.review_date,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      overallRating: row.overall_rating,
      summary: row.summary,
      goals: row.goals,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const currentSalary =
      salaryRes.data && salaryRes.data.length > 0
        ? {
            id: salaryRes.data[0].id,
            employeeId: salaryRes.data[0].employee_id,
            effectiveFrom: salaryRes.data[0].effective_from,
            salaryAmountSek: parseFloat(salaryRes.data[0].salary_amount_sek) || 0,
            salaryType: salaryRes.data[0].salary_type || "monthly",
            positionTitle: salaryRes.data[0].position_title,
            notes: salaryRes.data[0].notes,
            createdAt: salaryRes.data[0].created_at,
            createdBy: salaryRes.data[0].created_by,
          }
        : null;

    const salaryRevisions = (revisionsRes.data || []).map((row: { manager: { name: string } | null } & Record<string, unknown>) => ({
      id: row.id,
      employeeId: row.employee_id,
      revisionDate: row.revision_date,
      previousSalarySek: parseFloat(String(row.previous_salary_sek)) || 0,
      newSalarySek: parseFloat(String(row.new_salary_sek)) || 0,
      salaryType: row.salary_type || "monthly",
      reason: row.reason,
      decidedByManagerId: row.decided_by_manager_id,
      decidedByManagerName: (row.manager as { name?: string } | null)?.name,
      documentId: row.document_id,
      createdAt: row.created_at,
    }));

    const meetings = (meetingsRes.data || []).map((row: Record<string, unknown>) => ({
      id: row.id,
      employeeId: row.employee_id,
      employeeName: (row.employee as { name?: string } | null)?.name,
      managerId: row.manager_id,
      managerName: (row.manager as { name?: string } | null)?.name,
      scheduledAt: row.scheduled_at,
      durationMinutes: row.duration_minutes,
      location: row.location,
      status: row.status,
      templateName: row.template_name,
      sharedAgenda: row.shared_agenda,
      employeeNotesPrivate: row.employee_notes_private,
      managerNotesPrivate: row.manager_notes_private,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    const employeeProfile = profileRowRes.data
      ? {
          photoUrl: profileRowRes.data.photo_url ?? null,
          bio: profileRowRes.data.bio ?? null,
          address: profileRowRes.data.address ?? null,
          city: profileRowRes.data.city ?? null,
          postalCode: profileRowRes.data.postal_code ?? null,
          country: profileRowRes.data.country ?? null,
          emergencyContactName: profileRowRes.data.emergency_contact_name ?? null,
          emergencyContactPhone: profileRowRes.data.emergency_contact_phone ?? null,
          emergencyContactRelation: profileRowRes.data.emergency_contact_relation ?? null,
          notes: profileRowRes.data.notes ?? null,
          siteId: profileRowRes.data.site_id ?? null,
          createdAt: profileRowRes.data.created_at,
          updatedAt: profileRowRes.data.updated_at,
        }
      : {};

    const res = NextResponse.json({
      skills,
      events,
      documents,
      equipment,
      reviews,
      currentSalary,
      salaryRevisions,
      meetings,
      employeeProfile,
    });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]/profile] GET", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

const PATCH_ALLOWED = [
  "photo_url",
  "bio",
  "address",
  "city",
  "postal_code",
  "country",
  "emergency_contact_name",
  "emergency_contact_phone",
  "emergency_contact_relation",
  "notes",
  "site_id",
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Employee id required" }, { status: 400 });
    }

    const { supabase, pendingCookies } = await createSupabaseServerClient();
    const org = await getActiveOrgFromSession(request, supabase);
    if (!org.ok) {
      const res = NextResponse.json({ error: org.error }, { status: org.status });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: employee, error: empError } = await supabaseAdmin
      .from("employees")
      .select("id, org_id")
      .eq("id", id)
      .eq("org_id", org.activeOrgId)
      .maybeSingle();

    if (empError || !employee) {
      const res = NextResponse.json({ error: "Employee not found" }, { status: 404 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    for (const key of PATCH_ALLOWED) {
      if (key in body) {
        const v = body[key];
        updates[key] = v === "" ? null : v;
      }
    }

    if (Object.keys(updates).length === 0) {
      const res = NextResponse.json({ error: "No allowed fields to update" }, { status: 400 });
      applySupabaseCookies(res, pendingCookies);
      return res;
    }

    const { data: existing } = await supabaseAdmin
      .from("employee_profiles")
      .select("employee_id")
      .eq("employee_id", id)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabaseAdmin
        .from("employee_profiles")
        .update(updates)
        .eq("employee_id", id)
        .eq("org_id", org.activeOrgId);

      if (updateError) {
        console.error("[api/employees/[id]/profile] PATCH update", updateError);
        const res = NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("employee_profiles")
        .insert({
          employee_id: id,
          org_id: org.activeOrgId,
          ...updates,
        });

      if (insertError) {
        console.error("[api/employees/[id]/profile] PATCH insert", insertError);
        const res = NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
        applySupabaseCookies(res, pendingCookies);
        return res;
      }
    }

    const res = NextResponse.json({ success: true });
    applySupabaseCookies(res, pendingCookies);
    return res;
  } catch (err) {
    console.error("[api/employees/[id]/profile] PATCH", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
