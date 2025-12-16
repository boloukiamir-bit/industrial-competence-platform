import { supabase } from "@/lib/supabaseClient";
import type { PersonEvent } from "@/types/domain";
import { getUpcomingMeetings, getOverdueActions } from "./oneToOne";

export async function enqueueDueEventNotifications(referenceDate: Date): Promise<number> {
  const { data: events, error } = await supabase
    .from("person_events")
    .select("*, employee:employee_id(name, email), manager:owner_manager_id(name, email)")
    .in("status", ["due_soon", "overdue"]);

  if (error || !events) {
    console.error("Error fetching due events:", error);
    return 0;
  }

  let count = 0;

  for (const event of events) {
    const employeeEmail = event.employee?.email;
    const managerEmail = event.manager?.email;

    if (employeeEmail) {
      const subject = event.status === "overdue"
        ? `[OVERDUE] ${event.title}`
        : `[Due Soon] ${event.title}`;

      const body = `
Hello ${event.employee?.name || ""},

This is a reminder about the following task:

Title: ${event.title}
Category: ${event.category}
Due Date: ${event.due_date}
Status: ${event.status}
${event.description ? `\nDescription: ${event.description}` : ""}

Please take action as soon as possible.

Best regards,
Industrial Competence Platform
      `.trim();

      const { error: insertError } = await supabase.from("email_outbox").insert({
        to_email: employeeEmail,
        subject,
        body,
        status: "pending",
        meta: { event_id: event.id, type: "due_event_employee" },
      });
      if (insertError) {
        console.error("Error inserting employee notification:", insertError);
      } else {
        count++;
      }
    }

    if (managerEmail && managerEmail !== employeeEmail) {
      const subject = event.status === "overdue"
        ? `[OVERDUE] Action required for ${event.employee?.name}: ${event.title}`
        : `[Due Soon] Reminder for ${event.employee?.name}: ${event.title}`;

      const body = `
Hello ${event.manager?.name || ""},

This is a reminder about a task for your team member ${event.employee?.name || ""}:

Title: ${event.title}
Category: ${event.category}
Due Date: ${event.due_date}
Status: ${event.status}
${event.description ? `\nDescription: ${event.description}` : ""}

Please ensure this is addressed.

Best regards,
Industrial Competence Platform
      `.trim();

      const { error: insertError } = await supabase.from("email_outbox").insert({
        to_email: managerEmail,
        subject,
        body,
        status: "pending",
        meta: { event_id: event.id, type: "due_event_manager" },
      });
      if (insertError) {
        console.error("Error inserting manager notification:", insertError);
      } else {
        count++;
      }
    }
  }

  return count;
}

export async function enqueueUpcomingOneToOnes(referenceDate: Date): Promise<number> {
  const meetings = await getUpcomingMeetings(7);

  let count = 0;

  for (const meeting of meetings) {
    const { data: employeeData } = await supabase
      .from("employees")
      .select("email")
      .eq("id", meeting.employeeId)
      .single();

    const { data: managerData } = await supabase
      .from("employees")
      .select("email")
      .eq("id", meeting.managerId)
      .single();

    const scheduledDate = new Date(meeting.scheduledAt).toLocaleDateString("sv-SE");
    const scheduledTime = new Date(meeting.scheduledAt).toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    if (employeeData?.email) {
      const subject = `Upcoming 1:1 Meeting on ${scheduledDate}`;
      const body = `
Hello ${meeting.employeeName || ""},

You have an upcoming 1:1 meeting scheduled:

Date: ${scheduledDate}
Time: ${scheduledTime}
${meeting.location ? `Location: ${meeting.location}` : ""}
${meeting.templateName ? `Type: ${meeting.templateName}` : ""}

${meeting.sharedAgenda ? `Agenda:\n${meeting.sharedAgenda}` : "Please prepare any topics you would like to discuss."}

Best regards,
Industrial Competence Platform
      `.trim();

      const { error: insertError } = await supabase.from("email_outbox").insert({
        to_email: employeeData.email,
        subject,
        body,
        status: "pending",
        meta: { meeting_id: meeting.id, type: "upcoming_1to1_employee" },
      });
      if (insertError) {
        console.error("Error inserting employee meeting notification:", insertError);
      } else {
        count++;
      }
    }

    if (managerData?.email) {
      const subject = `Upcoming 1:1 with ${meeting.employeeName} on ${scheduledDate}`;
      const body = `
Hello ${meeting.managerName || ""},

You have an upcoming 1:1 meeting with ${meeting.employeeName}:

Date: ${scheduledDate}
Time: ${scheduledTime}
${meeting.location ? `Location: ${meeting.location}` : ""}
${meeting.templateName ? `Type: ${meeting.templateName}` : ""}

${meeting.sharedAgenda ? `Agenda:\n${meeting.sharedAgenda}` : ""}

Best regards,
Industrial Competence Platform
      `.trim();

      const { error: insertError } = await supabase.from("email_outbox").insert({
        to_email: managerData.email,
        subject,
        body,
        status: "pending",
        meta: { meeting_id: meeting.id, type: "upcoming_1to1_manager" },
      });
      if (insertError) {
        console.error("Error inserting manager meeting notification:", insertError);
      } else {
        count++;
      }
    }
  }

  return count;
}

export async function enqueueOverdueActions(referenceDate: Date): Promise<number> {
  const overdueActions = await getOverdueActions();

  let count = 0;

  for (const action of overdueActions) {
    const recipientEmail = action.ownerType === "employee"
      ? action.employeeEmail
      : action.managerEmail;

    if (recipientEmail) {
      const subject = `[Overdue Action] ${action.description.substring(0, 50)}...`;
      const body = `
Hello,

You have an overdue action item from a 1:1 meeting:

Action: ${action.description}
Due Date: ${action.dueDate}

Please complete this action as soon as possible.

Best regards,
Industrial Competence Platform
      `.trim();

      const { error: insertError } = await supabase.from("email_outbox").insert({
        to_email: recipientEmail,
        subject,
        body,
        status: "pending",
        meta: { action_id: action.id, type: "overdue_action" },
      });
      if (insertError) {
        console.error("Error inserting overdue action notification:", insertError);
      } else {
        count++;
      }
    }
  }

  return count;
}

export async function getPendingEmails(): Promise<number> {
  const { count, error } = await supabase
    .from("email_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  if (error) {
    console.error("Error counting pending emails:", error);
    return 0;
  }

  return count || 0;
}

export async function markEmailSent(emailId: string): Promise<boolean> {
  const { error } = await supabase
    .from("email_outbox")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .eq("id", emailId);

  return !error;
}

export async function markEmailFailed(emailId: string, errorMessage: string): Promise<boolean> {
  const { error } = await supabase
    .from("email_outbox")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", emailId);

  return !error;
}
