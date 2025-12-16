import { supabase } from "@/lib/supabaseClient";
import type { PersonEvent } from "@/types/domain";
import { getUpcomingMeetings, getOverdueActions } from "./oneToOne";

export async function enqueueDueEventNotifications(referenceDate: Date): Promise<number> {
  const { data: events, error } = await supabase
    .from("person_events")
    .select("id, title, category, due_date, employee_id, employees:employee_id(name, email)")
    .neq("status", "completed");

  if (error || !events) {
    console.error("Error fetching due events:", error);
    return 0;
  }

  let count = 0;

  for (const event of events) {
    const employeesData = event.employees as unknown;
    const employee = Array.isArray(employeesData) 
      ? (employeesData[0] as { name: string; email: string } | undefined) 
      : (employeesData as { name: string; email: string } | null);
    const toEmail = employee?.email;

    if (!toEmail) continue;

    const subject = `Action required: ${event.title}`;
    const body = `Hello ${employee?.name || ""},

You have an upcoming HR task that requires attention:

Category: ${event.category}
Task: ${event.title}
Due date: ${event.due_date}

This is an automated reminder.

Best regards,
Industrial Competence Platform`;

    const { error: insertError } = await supabase.from("email_outbox").insert({
      to_email: toEmail,
      subject,
      body,
      status: "pending",
      meta: { event_id: event.id, type: "due_event" },
    });

    if (insertError) {
      console.error("Error inserting notification:", insertError);
    } else {
      count++;
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
