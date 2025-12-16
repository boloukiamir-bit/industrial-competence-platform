module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/lib/supabaseClient.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || "";
const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || "";
function createSupabaseClient() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");
}
const supabase = createSupabaseClient();
function getSupabaseClient() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return supabase;
}
}),
"[project]/services/oneToOne.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addAction",
    ()=>addAction,
    "completeAction",
    ()=>completeAction,
    "createMeeting",
    ()=>createMeeting,
    "getActionsForMeeting",
    ()=>getActionsForMeeting,
    "getAllMeetings",
    ()=>getAllMeetings,
    "getMeetingById",
    ()=>getMeetingById,
    "getMeetingsForEmployee",
    ()=>getMeetingsForEmployee,
    "getMeetingsForManager",
    ()=>getMeetingsForManager,
    "getOverdueActions",
    ()=>getOverdueActions,
    "getUpcomingMeetings",
    ()=>getUpcomingMeetings,
    "updateMeeting",
    ()=>updateMeeting
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-route] (ecmascript)");
;
async function getAllMeetings() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").select("*, employee:employee_id(name), manager:manager_id(name)").order("scheduled_at", {
        ascending: false
    });
    if (error) {
        console.error("Error fetching all meetings:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            employeeId: row.employee_id,
            employeeName: row.employee?.name || undefined,
            managerId: row.manager_id || undefined,
            managerName: row.manager?.name || undefined,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes || undefined,
            location: row.location || undefined,
            status: row.status,
            templateName: row.template_name || undefined,
            sharedAgenda: row.shared_agenda || undefined,
            employeeNotesPrivate: row.employee_notes_private || undefined,
            managerNotesPrivate: row.manager_notes_private || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at || undefined
        }));
}
async function getMeetingsForEmployee(employeeId) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").select("*, employee:employee_id(name), manager:manager_id(name)").eq("employee_id", employeeId).order("scheduled_at", {
        ascending: false
    });
    if (error) {
        console.error("Error fetching meetings for employee:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            employeeId: row.employee_id,
            employeeName: row.employee?.name || undefined,
            managerId: row.manager_id || undefined,
            managerName: row.manager?.name || undefined,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes || undefined,
            location: row.location || undefined,
            status: row.status,
            templateName: row.template_name || undefined,
            sharedAgenda: row.shared_agenda || undefined,
            employeeNotesPrivate: row.employee_notes_private || undefined,
            managerNotesPrivate: row.manager_notes_private || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at || undefined
        }));
}
async function getMeetingsForManager(managerId) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").select("*, employee:employee_id(name), manager:manager_id(name)").eq("manager_id", managerId).order("scheduled_at", {
        ascending: false
    });
    if (error) {
        console.error("Error fetching meetings for manager:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            employeeId: row.employee_id,
            employeeName: row.employee?.name || undefined,
            managerId: row.manager_id || undefined,
            managerName: row.manager?.name || undefined,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes || undefined,
            location: row.location || undefined,
            status: row.status,
            templateName: row.template_name || undefined,
            sharedAgenda: row.shared_agenda || undefined,
            employeeNotesPrivate: row.employee_notes_private || undefined,
            managerNotesPrivate: row.manager_notes_private || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at || undefined
        }));
}
async function getMeetingById(id) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").select("*, employee:employee_id(name), manager:manager_id(name)").eq("id", id).single();
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
        status: data.status,
        templateName: data.template_name || undefined,
        sharedAgenda: data.shared_agenda || undefined,
        employeeNotesPrivate: data.employee_notes_private || undefined,
        managerNotesPrivate: data.manager_notes_private || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at || undefined
    };
}
async function createMeeting(payload) {
    if (!payload.employeeId || !payload.managerId || !payload.scheduledAt) {
        console.error("Invalid meeting payload: missing required fields");
        return null;
    }
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").insert({
        employee_id: payload.employeeId,
        manager_id: payload.managerId,
        scheduled_at: payload.scheduledAt,
        duration_minutes: payload.durationMinutes || null,
        location: payload.location || null,
        template_name: payload.templateName || null,
        shared_agenda: payload.sharedAgenda || null,
        status: "planned"
    }).select().single();
    if (error || !data) {
        console.error("Error creating meeting:", error);
        return null;
    }
    return {
        id: data.id,
        employeeId: data.employee_id,
        managerId: data.manager_id || undefined,
        scheduledAt: data.scheduled_at,
        durationMinutes: data.duration_minutes || undefined,
        location: data.location || undefined,
        status: data.status,
        templateName: data.template_name || undefined,
        sharedAgenda: data.shared_agenda || undefined,
        employeeNotesPrivate: data.employee_notes_private || undefined,
        managerNotesPrivate: data.manager_notes_private || undefined,
        createdAt: data.created_at,
        updatedAt: data.updated_at || undefined
    };
}
async function updateMeeting(id, updates) {
    if (!id) {
        console.error("Invalid updateMeeting: missing meeting id");
        return false;
    }
    const validStatuses = [
        "planned",
        "in_progress",
        "completed",
        "cancelled"
    ];
    if (updates.status !== undefined && !validStatuses.includes(updates.status)) {
        console.error("Invalid status value:", updates.status);
        return false;
    }
    const updateData = {
        updated_at: new Date().toISOString()
    };
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.sharedAgenda !== undefined) updateData.shared_agenda = updates.sharedAgenda;
    if (updates.employeeNotesPrivate !== undefined) updateData.employee_notes_private = updates.employeeNotesPrivate;
    if (updates.managerNotesPrivate !== undefined) updateData.manager_notes_private = updates.managerNotesPrivate;
    if (updates.scheduledAt !== undefined) updateData.scheduled_at = updates.scheduledAt;
    if (updates.durationMinutes !== undefined) updateData.duration_minutes = updates.durationMinutes;
    if (updates.location !== undefined) updateData.location = updates.location;
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").update(updateData).eq("id", id);
    if (error) {
        console.error("Error updating meeting:", error);
        return false;
    }
    return true;
}
async function getActionsForMeeting(meetingId) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_actions").select("*").eq("meeting_id", meetingId).order("created_at", {
        ascending: true
    });
    if (error) {
        console.error("Error fetching actions:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            meetingId: row.meeting_id,
            description: row.description,
            ownerType: row.owner_type,
            isCompleted: row.is_completed,
            dueDate: row.due_date || undefined,
            createdAt: row.created_at,
            completedAt: row.completed_at || undefined
        }));
}
async function addAction(meetingId, payload) {
    if (!meetingId || !payload.description || !payload.description.trim()) {
        console.error("Invalid action payload: missing meetingId or description");
        return null;
    }
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_actions").insert({
        meeting_id: meetingId,
        description: payload.description.trim(),
        owner_type: payload.ownerType,
        due_date: payload.dueDate || null
    }).select().single();
    if (error || !data) {
        console.error("Error adding action:", error);
        return null;
    }
    return {
        id: data.id,
        meetingId: data.meeting_id,
        description: data.description,
        ownerType: data.owner_type,
        isCompleted: data.is_completed,
        dueDate: data.due_date || undefined,
        createdAt: data.created_at,
        completedAt: data.completed_at || undefined
    };
}
async function completeAction(actionId) {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_actions").update({
        is_completed: true,
        completed_at: new Date().toISOString()
    }).eq("id", actionId);
    if (error) {
        console.error("Error completing action:", error);
        return false;
    }
    return true;
}
async function getUpcomingMeetings(daysAhead = 7) {
    const now = new Date();
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_meetings").select("*, employee:employee_id(name, email), manager:manager_id(name, email)").eq("status", "planned").gte("scheduled_at", now.toISOString()).lte("scheduled_at", futureDate.toISOString()).order("scheduled_at", {
        ascending: true
    });
    if (error) {
        console.error("Error fetching upcoming meetings:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            employeeId: row.employee_id,
            employeeName: row.employee?.name || undefined,
            managerId: row.manager_id || undefined,
            managerName: row.manager?.name || undefined,
            scheduledAt: row.scheduled_at,
            durationMinutes: row.duration_minutes || undefined,
            location: row.location || undefined,
            status: row.status,
            templateName: row.template_name || undefined,
            sharedAgenda: row.shared_agenda || undefined,
            employeeNotesPrivate: row.employee_notes_private || undefined,
            managerNotesPrivate: row.manager_notes_private || undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at || undefined
        }));
}
async function getOverdueActions() {
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("one_to_one_actions").select("*, meeting:meeting_id(employee:employee_id(email), manager:manager_id(email))").eq("is_completed", false).lt("due_date", today);
    if (error) {
        console.error("Error fetching overdue actions:", error);
        return [];
    }
    return (data || []).map((row)=>({
            id: row.id,
            meetingId: row.meeting_id,
            description: row.description,
            ownerType: row.owner_type,
            isCompleted: row.is_completed,
            dueDate: row.due_date || undefined,
            createdAt: row.created_at,
            completedAt: row.completed_at || undefined,
            employeeEmail: row.meeting?.employee?.email || undefined,
            managerEmail: row.meeting?.manager?.email || undefined
        }));
}
}),
"[project]/services/notifications.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "enqueueDueEventNotifications",
    ()=>enqueueDueEventNotifications,
    "enqueueOverdueActions",
    ()=>enqueueOverdueActions,
    "enqueueUpcomingOneToOnes",
    ()=>enqueueUpcomingOneToOnes,
    "getPendingEmails",
    ()=>getPendingEmails,
    "markEmailFailed",
    ()=>markEmailFailed,
    "markEmailSent",
    ()=>markEmailSent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$oneToOne$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/oneToOne.ts [app-route] (ecmascript)");
;
;
async function enqueueDueEventNotifications(referenceDate) {
    const { data: events, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("person_events").select("id, title, category, due_date, employee_id, employees:employee_id(name, email)").neq("status", "completed");
    if (error || !events) {
        console.error("Error fetching due events:", error);
        return 0;
    }
    let count = 0;
    for (const event of events){
        const employeesData = event.employees;
        const employee = Array.isArray(employeesData) ? employeesData[0] : employeesData;
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
        const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").insert({
            to_email: toEmail,
            subject,
            body,
            status: "pending",
            meta: {
                event_id: event.id,
                type: "due_event"
            }
        });
        if (insertError) {
            console.error("Error inserting notification:", insertError);
        } else {
            count++;
        }
    }
    return count;
}
async function enqueueUpcomingOneToOnes(referenceDate) {
    const meetings = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$oneToOne$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUpcomingMeetings"])(7);
    let count = 0;
    for (const meeting of meetings){
        const { data: employeeData } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("email").eq("id", meeting.employeeId).single();
        const { data: managerData } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("email").eq("id", meeting.managerId).single();
        const scheduledDate = new Date(meeting.scheduledAt).toLocaleDateString("sv-SE");
        const scheduledTime = new Date(meeting.scheduledAt).toLocaleTimeString("sv-SE", {
            hour: "2-digit",
            minute: "2-digit"
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
            const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").insert({
                to_email: employeeData.email,
                subject,
                body,
                status: "pending",
                meta: {
                    meeting_id: meeting.id,
                    type: "upcoming_1to1_employee"
                }
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
            const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").insert({
                to_email: managerData.email,
                subject,
                body,
                status: "pending",
                meta: {
                    meeting_id: meeting.id,
                    type: "upcoming_1to1_manager"
                }
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
async function enqueueOverdueActions(referenceDate) {
    const overdueActions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$oneToOne$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getOverdueActions"])();
    let count = 0;
    for (const action of overdueActions){
        const recipientEmail = action.ownerType === "employee" ? action.employeeEmail : action.managerEmail;
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
            const { error: insertError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").insert({
                to_email: recipientEmail,
                subject,
                body,
                status: "pending",
                meta: {
                    action_id: action.id,
                    type: "overdue_action"
                }
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
async function getPendingEmails() {
    const { count, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").select("*", {
        count: "exact",
        head: true
    }).eq("status", "pending");
    if (error) {
        console.error("Error counting pending emails:", error);
        return 0;
    }
    return count || 0;
}
async function markEmailSent(emailId) {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").update({
        status: "sent",
        sent_at: new Date().toISOString()
    }).eq("id", emailId);
    return !error;
}
async function markEmailFailed(emailId, errorMessage) {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("email_outbox").update({
        status: "failed",
        error_message: errorMessage
    }).eq("id", emailId);
    return !error;
}
}),
"[project]/app/api/cron/daily-notifications/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/notifications.ts [app-route] (ecmascript)");
;
;
async function GET() {
    const referenceDate = new Date();
    try {
        const [dueEventCount, upcomingCount, overdueCount] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enqueueDueEventNotifications"])(referenceDate),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enqueueUpcomingOneToOnes"])(referenceDate),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$notifications$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["enqueueOverdueActions"])(referenceDate)
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            referenceDate: referenceDate.toISOString(),
            notifications: {
                dueEvents: dueEventCount,
                upcomingOneToOnes: upcomingCount,
                overdueActions: overdueCount,
                total: dueEventCount + upcomingCount + overdueCount
            }
        });
    } catch (error) {
        console.error("Error running daily notifications:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, {
            status: 500
        });
    }
}
async function POST() {
    return GET();
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0bae62ae._.js.map