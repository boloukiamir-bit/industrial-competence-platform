import { supabase } from "@/lib/supabaseClient";
import type { SalaryRecord, SalaryRevision } from "@/types/domain";

export async function getSalaryRecords(employeeId: string): Promise<SalaryRecord[]> {
  const { data, error } = await supabase
    .from("salary_records")
    .select("*")
    .eq("employee_id", employeeId)
    .order("effective_from", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    effectiveFrom: row.effective_from,
    salaryAmountSek: parseFloat(row.salary_amount_sek),
    salaryType: row.salary_type,
    positionTitle: row.position_title,
    notes: row.notes,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }));
}

export async function getCurrentSalary(employeeId: string): Promise<SalaryRecord | null> {
  const records = await getSalaryRecords(employeeId);
  return records.length > 0 ? records[0] : null;
}

export async function getSalaryRevisions(employeeId: string): Promise<SalaryRevision[]> {
  const { data, error } = await supabase
    .from("salary_revisions")
    .select("*, manager:decided_by_manager_id(name)")
    .eq("employee_id", employeeId)
    .order("revision_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    revisionDate: row.revision_date,
    previousSalarySek: parseFloat(row.previous_salary_sek),
    newSalarySek: parseFloat(row.new_salary_sek),
    salaryType: row.salary_type,
    reason: row.reason,
    decidedByManagerId: row.decided_by_manager_id,
    decidedByManagerName: row.manager?.name,
    documentId: row.document_id,
    createdAt: row.created_at,
  }));
}

export async function createSalaryRevision(data: {
  employeeId: string;
  revisionDate: string;
  previousSalarySek: number;
  newSalarySek: number;
  salaryType: 'monthly' | 'hourly';
  reason?: string;
  decidedByManagerId?: string;
}): Promise<void> {
  await supabase.from("salary_revisions").insert({
    employee_id: data.employeeId,
    revision_date: data.revisionDate,
    previous_salary_sek: data.previousSalarySek,
    new_salary_sek: data.newSalarySek,
    salary_type: data.salaryType,
    reason: data.reason || null,
    decided_by_manager_id: data.decidedByManagerId || null,
  });

  await supabase.from("salary_records").insert({
    employee_id: data.employeeId,
    effective_from: data.revisionDate,
    salary_amount_sek: data.newSalarySek,
    salary_type: data.salaryType,
  });
}
