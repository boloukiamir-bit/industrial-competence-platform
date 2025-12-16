import { supabase } from "@/lib/supabaseClient";

export interface IcsEventInput {
  id: string;
  scheduled_at: string;
  duration_minutes?: number;
  employee_name: string;
  manager_name: string;
  employee_email: string;
  manager_email: string;
  location?: string;
}

function formatIcsDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateIcsForOneToOne(meeting: IcsEventInput): string {
  const startDate = new Date(meeting.scheduled_at);
  const durationMs = (meeting.duration_minutes || 60) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const uid = `meeting-${meeting.id}@industrialcompetence.app`;
  const dtstamp = formatIcsDate(new Date());
  const dtstart = formatIcsDate(startDate);
  const dtend = formatIcsDate(endDate);

  const summary = escapeIcsText(`1:1 meeting – ${meeting.employee_name} & ${meeting.manager_name}`);
  const description = escapeIcsText(
    `1:1 meeting between ${meeting.employee_name} and ${meeting.manager_name}.\n\nView details: /app/one-to-ones/${meeting.id}`
  );
  const location = meeting.location ? escapeIcsText(meeting.location) : "";

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Industrial Competence Platform//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : "",
    `ORGANIZER;CN=${escapeIcsText(meeting.manager_name)}:mailto:${meeting.manager_email}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeIcsText(meeting.manager_name)}:mailto:${meeting.manager_email}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeIcsText(meeting.employee_name)}:mailto:${meeting.employee_email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  return lines.join("\r\n");
}

export async function enqueueCalendarInviteEmails(meeting: IcsEventInput): Promise<number> {
  const icsContent = generateIcsForOneToOne(meeting);
  const scheduledDate = new Date(meeting.scheduled_at).toLocaleDateString("sv-SE");
  const scheduledTime = new Date(meeting.scheduled_at).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let count = 0;

  const employeeSubject = `1:1 meeting scheduled – ${scheduledDate} ${scheduledTime}`;
  const employeeBody = `Hello ${meeting.employee_name},

A 1:1 meeting has been scheduled with ${meeting.manager_name}.

Date: ${scheduledDate}
Time: ${scheduledTime}
Duration: ${meeting.duration_minutes || 60} minutes
${meeting.location ? `Location: ${meeting.location}` : ""}

Please add this to your calendar using the attached invite.

Best regards,
Industrial Competence Platform`;

  const { error: empError } = await supabase.from("email_outbox").insert({
    to_email: meeting.employee_email,
    subject: employeeSubject,
    body: employeeBody,
    status: "pending",
    meta: {
      type: "one_to_one_invite",
      meeting_id: meeting.id,
      recipient_role: "employee",
      ics: icsContent,
    },
  });

  if (!empError) count++;

  const managerSubject = `1:1 meeting scheduled with ${meeting.employee_name} – ${scheduledDate} ${scheduledTime}`;
  const managerBody = `Hello ${meeting.manager_name},

A 1:1 meeting has been scheduled with ${meeting.employee_name}.

Date: ${scheduledDate}
Time: ${scheduledTime}
Duration: ${meeting.duration_minutes || 60} minutes
${meeting.location ? `Location: ${meeting.location}` : ""}

Please add this to your calendar using the attached invite.

Best regards,
Industrial Competence Platform`;

  const { error: mgrError } = await supabase.from("email_outbox").insert({
    to_email: meeting.manager_email,
    subject: managerSubject,
    body: managerBody,
    status: "pending",
    meta: {
      type: "one_to_one_invite",
      meeting_id: meeting.id,
      recipient_role: "manager",
      ics: icsContent,
    },
  });

  if (!mgrError) count++;

  return count;
}
