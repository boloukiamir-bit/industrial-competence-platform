import { supabase } from "@/lib/supabaseClient";
import type { OneToOneMeeting, OneToOneAction, OneToOneMeetingStatus, OneToOneActionOwner } from "@/types/domain";
import { enqueueCalendarInviteEmails } from "@/lib/calendar";

export async function getAllMeetings(): Promise<OneToOneMeeting[]> {
  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .select("*, employee:employee_id(name), manager:manager_id(name)")
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("Error fetching all meetings:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.name || undefined,
    managerId: row.manager_id || undefined,
    managerName: row.manager?.name || undefined,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes || undefined,
    location: row.location || undefined,
    status: row.status as OneToOneMeetingStatus,
    templateName: row.template_name || undefined,
    sharedAgenda: row.shared_agenda || undefined,
    employeeNotesPrivate: row.employee_notes_private || undefined,
    managerNotesPrivate: row.manager_notes_private || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
}

export async function getMeetingsForEmployee(employeeId: string): Promise<OneToOneMeeting[]> {
  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .select("*, employee:employee_id(name), manager:manager_id(name)")
    .eq("employee_id", employeeId)
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("Error fetching meetings for employee:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.name || undefined,
    managerId: row.manager_id || undefined,
    managerName: row.manager?.name || undefined,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes || undefined,
    location: row.location || undefined,
    status: row.status as OneToOneMeetingStatus,
    templateName: row.template_name || undefined,
    sharedAgenda: row.shared_agenda || undefined,
    employeeNotesPrivate: row.employee_notes_private || undefined,
    managerNotesPrivate: row.manager_notes_private || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
}

export async function getMeetingsForManager(managerId: string): Promise<OneToOneMeeting[]> {
  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .select("*, employee:employee_id(name), manager:manager_id(name)")
    .eq("manager_id", managerId)
    .order("scheduled_at", { ascending: false });

  if (error) {
    console.error("Error fetching meetings for manager:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.name || undefined,
    managerId: row.manager_id || undefined,
    managerName: row.manager?.name || undefined,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes || undefined,
    location: row.location || undefined,
    status: row.status as OneToOneMeetingStatus,
    templateName: row.template_name || undefined,
    sharedAgenda: row.shared_agenda || undefined,
    employeeNotesPrivate: row.employee_notes_private || undefined,
    managerNotesPrivate: row.manager_notes_private || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
}

export async function getMeetingById(id: string): Promise<OneToOneMeeting | null> {
  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .select("*, employee:employee_id(name), manager:manager_id(name)")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching meeting:", error);
    return null;
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: data.employee?.name || undefined,
    managerId: data.manager_id || undefined,
    managerName: data.manager?.name || undefined,
    scheduledAt: data.scheduled_at,
    durationMinutes: data.duration_minutes || undefined,
    location: data.location || undefined,
    status: data.status as OneToOneMeetingStatus,
    templateName: data.template_name || undefined,
    sharedAgenda: data.shared_agenda || undefined,
    employeeNotesPrivate: data.employee_notes_private || undefined,
    managerNotesPrivate: data.manager_notes_private || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at || undefined,
  };
}

export type CreateMeetingPayload = {
  employeeId: string;
  managerId: string;
  scheduledAt: string;
  durationMinutes?: number;
  location?: string;
  templateName?: string;
  sharedAgenda?: string;
  orgId?: string;
};

export async function createMeeting(payload: CreateMeetingPayload): Promise<OneToOneMeeting | null> {
  if (!payload.employeeId || !payload.managerId || !payload.scheduledAt) {
    console.error("Invalid meeting payload: missing required fields");
    return null;
  }
  if (!payload.orgId) {
    console.error("Invalid meeting payload: missing orgId");
    return null;
  }

  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .insert({
      employee_id: payload.employeeId,
      manager_id: payload.managerId,
      scheduled_at: payload.scheduledAt,
      duration_minutes: payload.durationMinutes || null,
      location: payload.location || null,
      template_name: payload.templateName || null,
      shared_agenda: payload.sharedAgenda || null,
      status: "planned",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error creating meeting:", error);
    return null;
  }

  const { data: employeeData } = await supabase
    .from("employees")
    .select("name, email")
    .eq("org_id", payload.orgId)
    .eq("id", payload.employeeId)
    .single();

  const { data: managerData } = await supabase
    .from("employees")
    .select("name, email")
    .eq("org_id", payload.orgId)
    .eq("id", payload.managerId)
    .single();

  if (employeeData?.email && managerData?.email) {
    try {
      await enqueueCalendarInviteEmails({
        id: data.id,
        scheduled_at: data.scheduled_at,
        duration_minutes: data.duration_minutes || undefined,
        employee_name: employeeData.name || "Employee",
        manager_name: managerData.name || "Manager",
        employee_email: employeeData.email,
        manager_email: managerData.email,
        location: data.location || undefined,
      });
    } catch (calendarError) {
      console.error("Error sending calendar invites:", calendarError);
    }
  }

  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeName: employeeData?.name || undefined,
    managerId: data.manager_id || undefined,
    managerName: managerData?.name || undefined,
    scheduledAt: data.scheduled_at,
    durationMinutes: data.duration_minutes || undefined,
    location: data.location || undefined,
    status: data.status as OneToOneMeetingStatus,
    templateName: data.template_name || undefined,
    sharedAgenda: data.shared_agenda || undefined,
    employeeNotesPrivate: data.employee_notes_private || undefined,
    managerNotesPrivate: data.manager_notes_private || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at || undefined,
  };
}

export type UpdateMeetingPayload = {
  status?: OneToOneMeetingStatus;
  sharedAgenda?: string;
  employeeNotesPrivate?: string;
  managerNotesPrivate?: string;
  scheduledAt?: string;
  durationMinutes?: number;
  location?: string;
};

export async function updateMeeting(id: string, updates: UpdateMeetingPayload): Promise<boolean> {
  if (!id) {
    console.error("Invalid updateMeeting: missing meeting id");
    return false;
  }

  const validStatuses: OneToOneMeetingStatus[] = ["planned", "in_progress", "completed", "cancelled"];
  if (updates.status !== undefined && !validStatuses.includes(updates.status)) {
    console.error("Invalid status value:", updates.status);
    return false;
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.sharedAgenda !== undefined) updateData.shared_agenda = updates.sharedAgenda;
  if (updates.employeeNotesPrivate !== undefined) updateData.employee_notes_private = updates.employeeNotesPrivate;
  if (updates.managerNotesPrivate !== undefined) updateData.manager_notes_private = updates.managerNotesPrivate;
  if (updates.scheduledAt !== undefined) updateData.scheduled_at = updates.scheduledAt;
  if (updates.durationMinutes !== undefined) updateData.duration_minutes = updates.durationMinutes;
  if (updates.location !== undefined) updateData.location = updates.location;

  const { error } = await supabase
    .from("one_to_one_meetings")
    .update(updateData)
    .eq("id", id);

  if (error) {
    console.error("Error updating meeting:", error);
    return false;
  }

  return true;
}

export async function getActionsForMeeting(meetingId: string): Promise<OneToOneAction[]> {
  const { data, error } = await supabase
    .from("one_to_one_actions")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching actions:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    description: row.description,
    ownerType: row.owner_type as OneToOneActionOwner,
    isCompleted: row.is_completed,
    dueDate: row.due_date || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
  }));
}

export type AddActionPayload = {
  description: string;
  ownerType: OneToOneActionOwner;
  dueDate?: string;
};

export async function addAction(meetingId: string, payload: AddActionPayload): Promise<OneToOneAction | null> {
  if (!meetingId || !payload.description || !payload.description.trim()) {
    console.error("Invalid action payload: missing meetingId or description");
    return null;
  }

  const { data, error } = await supabase
    .from("one_to_one_actions")
    .insert({
      meeting_id: meetingId,
      description: payload.description.trim(),
      owner_type: payload.ownerType,
      due_date: payload.dueDate || null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Error adding action:", error);
    return null;
  }

  return {
    id: data.id,
    meetingId: data.meeting_id,
    description: data.description,
    ownerType: data.owner_type as OneToOneActionOwner,
    isCompleted: data.is_completed,
    dueDate: data.due_date || undefined,
    createdAt: data.created_at,
    completedAt: data.completed_at || undefined,
  };
}

export async function completeAction(actionId: string): Promise<boolean> {
  const { error } = await supabase
    .from("one_to_one_actions")
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
    })
    .eq("id", actionId);

  if (error) {
    console.error("Error completing action:", error);
    return false;
  }

  return true;
}

export async function getUpcomingMeetings(daysAhead: number = 7): Promise<OneToOneMeeting[]> {
  const now = new Date();
  const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from("one_to_one_meetings")
    .select("*, employee:employee_id(name, email), manager:manager_id(name, email)")
    .eq("status", "planned")
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", futureDate.toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error("Error fetching upcoming meetings:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee?.name || undefined,
    managerId: row.manager_id || undefined,
    managerName: row.manager?.name || undefined,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes || undefined,
    location: row.location || undefined,
    status: row.status as OneToOneMeetingStatus,
    templateName: row.template_name || undefined,
    sharedAgenda: row.shared_agenda || undefined,
    employeeNotesPrivate: row.employee_notes_private || undefined,
    managerNotesPrivate: row.manager_notes_private || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at || undefined,
  }));
}

export async function getOverdueActions(): Promise<(OneToOneAction & { employeeEmail?: string; managerEmail?: string })[]> {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("one_to_one_actions")
    .select("*, meeting:meeting_id(employee:employee_id(email), manager:manager_id(email))")
    .eq("is_completed", false)
    .lt("due_date", today);

  if (error) {
    console.error("Error fetching overdue actions:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id,
    description: row.description,
    ownerType: row.owner_type as OneToOneActionOwner,
    isCompleted: row.is_completed,
    dueDate: row.due_date || undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at || undefined,
    employeeEmail: row.meeting?.employee?.email || undefined,
    managerEmail: row.meeting?.manager?.email || undefined,
  }));
}
