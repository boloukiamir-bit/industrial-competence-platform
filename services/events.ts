import { supabase } from "@/lib/supabaseClient";
import type { PersonEvent, PersonEventCategory, PersonEventStatus } from "@/types/domain";

function parseRecurrence(recurrence: string): number {
  const match = recurrence.match(/^(\d+)m$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 0;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function calculateStatus(dueDate: string, completedDate?: string): PersonEventStatus {
  if (completedDate) return "completed";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  
  const sixtyDaysFromNow = new Date(today);
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  
  if (due < today) return "overdue";
  if (due <= sixtyDaysFromNow) return "due_soon";
  return "upcoming";
}

export async function getEventsForManager(managerId: string): Promise<PersonEvent[]> {
  const { data, error } = await supabase
    .from("person_events")
    .select(`
      id,
      employee_id,
      category,
      title,
      description,
      due_date,
      completed_date,
      recurrence,
      owner_manager_id,
      status,
      notes,
      employees:employee_id (name)
    `)
    .eq("owner_manager_id", managerId)
    .order("due_date", { ascending: true });

  if (error) {
    // Only log errors in development to reduce console noise
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch events:", error.message || error);
    }
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.name || "Unknown",
    category: row.category as PersonEventCategory,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    recurrence: row.recurrence,
    ownerManagerId: row.owner_manager_id,
    status: calculateStatus(row.due_date, row.completed_date),
    notes: row.notes,
  }));
}

export async function getAllEvents(): Promise<PersonEvent[]> {
  const { data, error } = await supabase
    .from("person_events")
    .select(`
      id,
      employee_id,
      category,
      title,
      description,
      due_date,
      completed_date,
      recurrence,
      owner_manager_id,
      status,
      notes,
      employees:employee_id (name)
    `)
    .order("due_date", { ascending: true });

  if (error) {
    // Only log errors in development to reduce console noise
    if (process.env.NODE_ENV !== "production") {
      console.error("Failed to fetch events:", error.message || error);
    }
    return [];
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employees?.name || "Unknown",
    category: row.category as PersonEventCategory,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    completedDate: row.completed_date,
    recurrence: row.recurrence,
    ownerManagerId: row.owner_manager_id,
    status: calculateStatus(row.due_date, row.completed_date),
    notes: row.notes,
  }));
}

export async function updateEventStatus(
  eventId: string,
  updates: {
    status?: string;
    due_date?: string;
    completed_date?: string;
    notes?: string;
  }
): Promise<void> {
  const { error } = await supabase
    .from("person_events")
    .update(updates)
    .eq("id", eventId);

  if (error) {
    throw new Error(`Failed to update event: ${error.message}`);
  }
}

export async function markEventCompleted(eventId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await updateEventStatus(eventId, {
    completed_date: today,
    status: "completed",
  });
}

export async function extendDueDate(eventId: string, days: number = 30): Promise<void> {
  const { data: event } = await supabase
    .from("person_events")
    .select("due_date")
    .eq("id", eventId)
    .single();

  if (event) {
    const newDate = new Date(event.due_date);
    newDate.setDate(newDate.getDate() + days);
    await updateEventStatus(eventId, {
      due_date: newDate.toISOString().slice(0, 10),
    });
  }
}

export async function autoGenerateContractEvents(): Promise<void> {
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, contract_end_date, manager_id")
    .eq("employment_type", "temporary")
    .not("contract_end_date", "is", null);

  if (!employees) return;

  for (const emp of employees) {
    const { data: existing } = await supabase
      .from("person_events")
      .select("id")
      .eq("employee_id", emp.id)
      .eq("category", "contract")
      .eq("title", "Tidsbegränsad anställning löper ut")
      .single();

    if (!existing) {
      await supabase.from("person_events").insert({
        employee_id: emp.id,
        category: "contract",
        title: "Tidsbegränsad anställning löper ut",
        description: `Kontraktet för ${emp.name} löper ut`,
        due_date: emp.contract_end_date,
        owner_manager_id: emp.manager_id,
        status: "upcoming",
      });
    }
  }
}

export async function autoGenerateRecurringEvents(): Promise<void> {
  const { data: completedEvents } = await supabase
    .from("person_events")
    .select("*")
    .eq("status", "completed")
    .not("recurrence", "is", null);

  if (!completedEvents) return;

  for (const event of completedEvents) {
    const months = parseRecurrence(event.recurrence);
    if (months <= 0) continue;

    const nextDueDate = addMonths(new Date(event.completed_date), months);
    const nextDueDateStr = nextDueDate.toISOString().slice(0, 10);

    const { data: existing } = await supabase
      .from("person_events")
      .select("id")
      .eq("employee_id", event.employee_id)
      .eq("category", event.category)
      .eq("title", event.title)
      .eq("due_date", nextDueDateStr)
      .single();

    if (!existing) {
      await supabase.from("person_events").insert({
        employee_id: event.employee_id,
        category: event.category,
        title: event.title,
        description: event.description,
        due_date: nextDueDateStr,
        recurrence: event.recurrence,
        owner_manager_id: event.owner_manager_id,
        status: "upcoming",
      });
    }
  }
}

export async function createOnboardingEvents(employeeId: string, managerId?: string): Promise<void> {
  const onboardingTasks = [
    { title: "Onboarding – introduktion", category: "onboarding" as PersonEventCategory },
    { title: "Arbetsmiljögenomgång", category: "work_env_delegation" as PersonEventCategory },
    { title: "Skapa AD-konto", category: "onboarding" as PersonEventCategory },
  ];

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  for (const task of onboardingTasks) {
    await supabase.from("person_events").insert({
      employee_id: employeeId,
      category: task.category,
      title: task.title,
      due_date: dueDateStr,
      owner_manager_id: managerId,
      status: "upcoming",
    });
  }
}

export async function createOffboardingEvents(employeeId: string, managerId?: string, endDate?: string): Promise<void> {
  const offboardingTasks = [
    { title: "Offboarding – återlämna utrustning", category: "offboarding" as PersonEventCategory },
    { title: "Stäng AD-konto", category: "offboarding" as PersonEventCategory },
    { title: "Exit-samtal", category: "offboarding" as PersonEventCategory },
  ];

  const dueDate = endDate ? new Date(endDate) : new Date();
  const dueDateStr = dueDate.toISOString().slice(0, 10);

  for (const task of offboardingTasks) {
    await supabase.from("person_events").insert({
      employee_id: employeeId,
      category: task.category,
      title: task.title,
      due_date: dueDateStr,
      owner_manager_id: managerId,
      status: "upcoming",
    });
  }
}
