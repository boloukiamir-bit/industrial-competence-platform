import { supabase } from "@/lib/supabaseClient";
import type { EmployeeReview, ReviewTemplate, ReviewGoal } from "@/types/domain";

export async function getReviewTemplates(): Promise<ReviewTemplate[]> {
  const { data, error } = await supabase
    .from("review_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    audience: row.audience,
    isActive: row.is_active,
    createdAt: row.created_at,
  }));
}

export async function getEmployeeReviews(employeeId: string): Promise<EmployeeReview[]> {
  const { data, error } = await supabase
    .from("employee_reviews")
    .select("*, manager:manager_id(name), template:template_id(name)")
    .eq("employee_id", employeeId)
    .order("review_date", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((row) => ({
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
    goals: row.goals as ReviewGoal[] | undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function createReview(data: {
  employeeId: string;
  managerId?: string;
  templateId?: string;
  reviewDate: string;
  periodStart?: string;
  periodEnd?: string;
  overallRating?: number;
  summary?: string;
  goals?: ReviewGoal[];
  notes?: string;
}): Promise<string> {
  const { data: result, error } = await supabase
    .from("employee_reviews")
    .insert({
      employee_id: data.employeeId,
      manager_id: data.managerId || null,
      template_id: data.templateId || null,
      review_date: data.reviewDate,
      period_start: data.periodStart || null,
      period_end: data.periodEnd || null,
      overall_rating: data.overallRating || null,
      summary: data.summary || null,
      goals: data.goals || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return result.id;
}
