import { supabase } from "@/lib/supabaseClient";

export async function logEmployeeAccess(
  employeeId: string,
  accessType: 'view_profile' | 'export_data' | 'download_document' | 'update_profile' | 'delete_profile',
  metadata?: Record<string, unknown>
): Promise<void> {
  await supabase.from("gdpr_access_logs").insert({
    employee_id: employeeId,
    access_type: accessType,
    metadata: metadata || null,
  });
}

export async function exportEmployeeData(employeeId: string, orgId: string): Promise<Record<string, unknown>> {
  const [
    employeeResult,
    skillsResult,
    eventsResult,
    salaryRecordsResult,
    salaryRevisionsResult,
    documentsResult,
    reviewsResult,
    equipmentResult,
  ] = await Promise.all([
    supabase.from("employees").select("*").eq("org_id", orgId).eq("id", employeeId).single(),
    supabase
      .from("employee_skills")
      .select("*, skills(*)")
      .eq("employee_id", employeeId)
      .eq("skills.org_id", orgId),
    supabase.from("person_events").select("*").eq("employee_id", employeeId),
    supabase.from("salary_records").select("*").eq("employee_id", employeeId).order("effective_from", { ascending: false }),
    supabase.from("salary_revisions").select("*").eq("employee_id", employeeId).order("revision_date", { ascending: false }),
    supabase.from("documents").select("id, title, type, created_at, valid_to").eq("employee_id", employeeId),
    supabase.from("employee_reviews").select("*").eq("employee_id", employeeId).order("review_date", { ascending: false }),
    supabase.from("employee_equipment").select("*, equipment(*)").eq("employee_id", employeeId),
  ]);

  await logEmployeeAccess(employeeId, "export_data", { exported_at: new Date().toISOString() });

  return {
    exportedAt: new Date().toISOString(),
    employee: employeeResult.data || null,
    skills: (skillsResult.data || []).map((s: Record<string, unknown>) => ({
      skillName: (s.skills as Record<string, unknown>)?.name,
      skillCode: (s.skills as Record<string, unknown>)?.code,
      level: s.level,
    })),
    personEvents: (eventsResult.data || []).map((e: Record<string, unknown>) => ({
      category: e.category,
      title: e.title,
      dueDate: e.due_date,
      completedDate: e.completed_date,
      status: e.status,
    })),
    salaryRecords: (salaryRecordsResult.data || []).map((s: Record<string, unknown>) => ({
      effectiveFrom: s.effective_from,
      salaryAmountSek: s.salary_amount_sek,
      salaryType: s.salary_type,
      positionTitle: s.position_title,
    })),
    salaryRevisions: (salaryRevisionsResult.data || []).map((s: Record<string, unknown>) => ({
      revisionDate: s.revision_date,
      previousSalarySek: s.previous_salary_sek,
      newSalarySek: s.new_salary_sek,
      reason: s.reason,
    })),
    documents: (documentsResult.data || []).map((d: Record<string, unknown>) => ({
      title: d.title,
      type: d.type,
      createdAt: d.created_at,
      validTo: d.valid_to,
    })),
    reviews: (reviewsResult.data || []).map((r: Record<string, unknown>) => ({
      reviewDate: r.review_date,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      overallRating: r.overall_rating,
      summary: r.summary,
    })),
    equipment: (equipmentResult.data || []).map((e: Record<string, unknown>) => ({
      equipmentName: (e.equipment as Record<string, unknown>)?.name,
      serialNumber: (e.equipment as Record<string, unknown>)?.serial_number,
      assignedDate: e.assigned_date,
      status: e.status,
    })),
  };
}

export async function anonymizeEmployee(employeeId: string, orgId: string): Promise<void> {
  await supabase
    .from("employees")
    .update({
      name: "Anonymiserad",
      first_name: null,
      last_name: null,
      email: null,
      phone: null,
      address: null,
      postal_code: null,
      city: null,
      date_of_birth: null,
      updated_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("id", employeeId);

  await logEmployeeAccess(employeeId, "delete_profile", { anonymized_at: new Date().toISOString() });
}
