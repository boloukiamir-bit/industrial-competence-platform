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
  const oneDayAgo = new Date(referenceDate.getTime() - 24 * 60 * 60 * 1000).toISOString();

  for (const event of events) {
    const employeesData = event.employees as unknown;
    const employee = Array.isArray(employeesData) 
      ? (employeesData[0] as { name: string; email: string } | undefined) 
      : (employeesData as { name: string; email: string } | null);
    const toEmail = employee?.email;

    if (!toEmail) continue;

    const { data: existingNotification } = await supabase
      .from("email_outbox")
      .select("id")
      .eq("to_email", toEmail)
      .gte("created_at", oneDayAgo)
      .filter("meta->>event_id", "eq", event.id)
      .filter("meta->>type", "eq", "due_event")
      .in("status", ["pending", "sent"])
      .limit(1);

    if (existingNotification && existingNotification.length > 0) {
      continue;
    }

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

export async function enqueueManagerDigestNotifications(referenceDate: Date): Promise<number> {
  const today = referenceDate.toISOString().split("T")[0];
  const sevenDaysLater = new Date(referenceDate.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: events, error } = await supabase
    .from("person_events")
    .select(`
      id, title, category, due_date, status,
      owner_manager_id,
      manager:owner_manager_id(id, name, email),
      employees:employee_id(name)
    `)
    .neq("status", "completed");

  if (error || !events) {
    console.error("Error fetching events for manager digest:", error);
    return 0;
  }

  const managerDigests: Record<string, {
    managerId: string;
    managerName: string;
    managerEmail: string;
    overdueByCategory: Record<string, number>;
    dueSoonByCategory: Record<string, number>;
    criticalItems: Array<{ title: string; employeeName: string; dueDate: string; isOverdue: boolean }>;
  }> = {};

  for (const event of events) {
    const managerData = event.manager as unknown;
    const manager = Array.isArray(managerData)
      ? (managerData[0] as { id: string; name: string; email: string } | undefined)
      : (managerData as { id: string; name: string; email: string } | null);

    if (!manager?.id || !manager?.email) continue;

    const employeeData = event.employees as unknown;
    const employee = Array.isArray(employeeData)
      ? (employeeData[0] as { name: string } | undefined)
      : (employeeData as { name: string } | null);

    const isOverdue = event.due_date < today;
    const isDueSoon = event.due_date >= today && event.due_date <= sevenDaysLater;

    if (!isOverdue && !isDueSoon) continue;

    if (!managerDigests[manager.id]) {
      managerDigests[manager.id] = {
        managerId: manager.id,
        managerName: manager.name || "Manager",
        managerEmail: manager.email,
        overdueByCategory: {},
        dueSoonByCategory: {},
        criticalItems: [],
      };
    }

    const digest = managerDigests[manager.id];
    const category = event.category || "other";

    if (isOverdue) {
      digest.overdueByCategory[category] = (digest.overdueByCategory[category] || 0) + 1;
    } else if (isDueSoon) {
      digest.dueSoonByCategory[category] = (digest.dueSoonByCategory[category] || 0) + 1;
    }

    digest.criticalItems.push({
      title: event.title,
      employeeName: employee?.name || "Unknown",
      dueDate: event.due_date,
      isOverdue,
    });
  }

  let count = 0;

  for (const digest of Object.values(managerDigests)) {
    const overdueTotal = Object.values(digest.overdueByCategory).reduce((s, c) => s + c, 0);
    const dueSoonTotal = Object.values(digest.dueSoonByCategory).reduce((s, c) => s + c, 0);

    if (overdueTotal === 0 && dueSoonTotal === 0) continue;

    const overdueLines = Object.entries(digest.overdueByCategory)
      .map(([cat, cnt]) => `  - ${cat}: ${cnt}`)
      .join("\n");

    const dueSoonLines = Object.entries(digest.dueSoonByCategory)
      .map(([cat, cnt]) => `  - ${cat}: ${cnt}`)
      .join("\n");

    const topItems = digest.criticalItems
      .sort((a, b) => (a.isOverdue === b.isOverdue ? 0 : a.isOverdue ? -1 : 1))
      .slice(0, 5);

    const topItemsLines = topItems
      .map((item) => `  - ${item.title} (${item.employeeName}) - Due: ${item.dueDate}${item.isOverdue ? " [OVERDUE]" : ""}`)
      .join("\n");

    const subject = "Weekly People Risk Digest";
    const body = `Hello ${digest.managerName},

Here is your weekly summary of people-related tasks requiring attention:

OVERDUE (${overdueTotal} total):
${overdueLines || "  None"}

DUE SOON - Next 7 days (${dueSoonTotal} total):
${dueSoonLines || "  None"}

TOP 5 CRITICAL ITEMS:
${topItemsLines || "  None"}

Please log in to the platform to take action.

Best regards,
Industrial Competence Platform`;

    const { error: insertError } = await supabase.from("email_outbox").insert({
      to_email: digest.managerEmail,
      subject,
      body,
      status: "pending",
      meta: { type: "manager_digest", manager_id: digest.managerId },
    });

    if (insertError) {
      console.error("Error inserting manager digest:", insertError);
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
