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
"[project]/lib/env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Environment variable helper with fail-fast behavior
 * Ensures Supabase credentials are always available
 */ __turbopack_context__.s([
    "getPublicEnv",
    ()=>getPublicEnv,
    "getServiceRoleKey",
    ()=>getServiceRoleKey,
    "validatePublicEnv",
    ()=>validatePublicEnv
]);
// Hardcoded fallback values for production builds
const FALLBACK_SUPABASE_URL = "https://bmvawfrnlpdvcmffqrzc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM";
function getPublicEnv() {
    const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || FALLBACK_SUPABASE_URL;
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || FALLBACK_SUPABASE_ANON_KEY;
    const missing = [];
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    if (missing.length > 0) {
        throw new Error(`Supabase env missing: ${missing.join(', ')}`);
    }
    return {
        supabaseUrl,
        supabaseAnonKey
    };
}
function validatePublicEnv() {
    const missing = [];
    const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || FALLBACK_SUPABASE_URL;
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || FALLBACK_SUPABASE_ANON_KEY;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return {
        valid: missing.length === 0,
        missing
    };
}
function getServiceRoleKey() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    return key;
}
}),
"[project]/lib/supabaseClient.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "isSupabaseReady",
    ()=>isSupabaseReady,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-route] (ecmascript)");
;
;
let supabaseInstance = null;
function createSupabaseClient() {
    const env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getPublicEnv"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
}
function getSupabaseClient() {
    if (!supabaseInstance) {
        supabaseInstance = createSupabaseClient();
    }
    return supabaseInstance;
}
const supabase = createSupabaseClient();
function isSupabaseReady() {
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validatePublicEnv"])();
    return validation.valid;
}
}),
"[project]/services/hrWorkflows.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WORKFLOW_TEMPLATES",
    ()=>WORKFLOW_TEMPLATES,
    "cancelWorkflow",
    ()=>cancelWorkflow,
    "completeWorkflowStep",
    ()=>completeWorkflowStep,
    "getTemplateById",
    ()=>getTemplateById,
    "getWorkflowById",
    ()=>getWorkflowById,
    "getWorkflowInstances",
    ()=>getWorkflowInstances,
    "getWorkflowTemplates",
    ()=>getWorkflowTemplates,
    "startWorkflow",
    ()=>startWorkflow
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-route] (ecmascript)");
;
const WORKFLOW_TEMPLATES = [
    {
        id: "sick_leave",
        name: "Sick Leave Follow-up",
        description: "Structured follow-up process for employees on sick leave according to Swedish labor law",
        category: "health",
        defaultSteps: [
            {
                title: "Day 1 Contact",
                description: "Manager contacts employee to check in",
                daysFromStart: 1,
                responsibleRole: "manager"
            },
            {
                title: "Week 1 Review",
                description: "Assess if return-to-work plan needed",
                daysFromStart: 7,
                responsibleRole: "hr"
            },
            {
                title: "Day 14 Coordination",
                description: "Evaluate need for rehab coordination with Försäkringskassan",
                daysFromStart: 14,
                responsibleRole: "hr"
            },
            {
                title: "Day 30 Meeting",
                description: "Formal meeting to discuss return or continued leave",
                daysFromStart: 30,
                responsibleRole: "manager"
            },
            {
                title: "Day 60 Rehab Plan",
                description: "If applicable, create detailed rehabilitation plan",
                daysFromStart: 60,
                responsibleRole: "hr"
            }
        ]
    },
    {
        id: "rehab",
        name: "Rehabilitation Process",
        description: "Comprehensive rehabilitation plan for returning employees to full capacity",
        category: "health",
        defaultSteps: [
            {
                title: "Initial Assessment",
                description: "Assess current capacity and restrictions",
                daysFromStart: 0,
                responsibleRole: "hr"
            },
            {
                title: "Doctor Consultation",
                description: "Review medical recommendations",
                daysFromStart: 3,
                responsibleRole: "hr"
            },
            {
                title: "Workplace Adjustment",
                description: "Implement necessary workplace adjustments",
                daysFromStart: 7,
                responsibleRole: "manager"
            },
            {
                title: "Week 2 Check-in",
                description: "Review progress and adjust if needed",
                daysFromStart: 14,
                responsibleRole: "manager"
            },
            {
                title: "Week 4 Evaluation",
                description: "Formal evaluation of rehab progress",
                daysFromStart: 28,
                responsibleRole: "hr"
            },
            {
                title: "Completion Review",
                description: "Final assessment and closure",
                daysFromStart: 56,
                responsibleRole: "hr"
            }
        ]
    },
    {
        id: "parental_leave",
        name: "Parental Leave",
        description: "Manage parental leave transitions smoothly for both departure and return",
        category: "leave",
        defaultSteps: [
            {
                title: "Notification Received",
                description: "Record parental leave request and planned dates",
                daysFromStart: 0,
                responsibleRole: "hr"
            },
            {
                title: "Handover Planning",
                description: "Plan work handover and coverage",
                daysFromStart: 7,
                responsibleRole: "manager"
            },
            {
                title: "Backfill Decision",
                description: "Determine if temporary replacement needed",
                daysFromStart: 14,
                responsibleRole: "hr"
            },
            {
                title: "Pre-departure Meeting",
                description: "Final handover meeting before leave",
                daysFromStart: -7,
                responsibleRole: "manager"
            },
            {
                title: "Return Contact",
                description: "Contact employee 30 days before planned return",
                daysFromStart: -30,
                responsibleRole: "hr"
            },
            {
                title: "Return Planning",
                description: "Plan reboarding activities",
                daysFromStart: -14,
                responsibleRole: "manager"
            }
        ]
    },
    {
        id: "reboarding",
        name: "Reboarding",
        description: "Re-integrate employees returning from extended leave",
        category: "lifecycle",
        defaultSteps: [
            {
                title: "Welcome Back Meeting",
                description: "Discuss changes and expectations",
                daysFromStart: 0,
                responsibleRole: "manager"
            },
            {
                title: "System Access Check",
                description: "Verify all system access is active",
                daysFromStart: 0,
                responsibleRole: "hr"
            },
            {
                title: "Training Update",
                description: "Review and schedule any required training updates",
                daysFromStart: 3,
                responsibleRole: "manager"
            },
            {
                title: "Week 1 Check-in",
                description: "Discuss how re-integration is going",
                daysFromStart: 7,
                responsibleRole: "manager"
            },
            {
                title: "30-day Review",
                description: "Formal review of reboarding success",
                daysFromStart: 30,
                responsibleRole: "hr"
            }
        ]
    },
    {
        id: "onboarding",
        name: "New Employee Onboarding",
        description: "Standard onboarding process for new employees",
        category: "lifecycle",
        defaultSteps: [
            {
                title: "Pre-start Preparation",
                description: "Prepare equipment, accounts, and workspace",
                daysFromStart: -7,
                responsibleRole: "hr"
            },
            {
                title: "Day 1 Welcome",
                description: "Welcome meeting and office tour",
                daysFromStart: 0,
                responsibleRole: "manager"
            },
            {
                title: "HR Introduction",
                description: "Policies, benefits, and compliance training",
                daysFromStart: 1,
                responsibleRole: "hr"
            },
            {
                title: "Week 1 Check-in",
                description: "Review first week experience",
                daysFromStart: 5,
                responsibleRole: "manager"
            },
            {
                title: "30-day Review",
                description: "Formal review of onboarding progress",
                daysFromStart: 30,
                responsibleRole: "manager"
            },
            {
                title: "90-day Review",
                description: "End of probation review",
                daysFromStart: 90,
                responsibleRole: "hr"
            }
        ]
    },
    {
        id: "offboarding",
        name: "Employee Offboarding",
        description: "Standard offboarding process for departing employees",
        category: "lifecycle",
        defaultSteps: [
            {
                title: "Exit Notice Received",
                description: "Document resignation or termination details",
                daysFromStart: 0,
                responsibleRole: "hr"
            },
            {
                title: "Handover Planning",
                description: "Plan knowledge transfer and handover",
                daysFromStart: 1,
                responsibleRole: "manager"
            },
            {
                title: "Exit Interview Scheduled",
                description: "Schedule exit interview if applicable",
                daysFromStart: 7,
                responsibleRole: "hr"
            },
            {
                title: "Equipment Return",
                description: "Collect company equipment and access cards",
                daysFromStart: -2,
                responsibleRole: "hr"
            },
            {
                title: "Final Day Procedures",
                description: "System access revocation, final paperwork",
                daysFromStart: 0,
                responsibleRole: "hr"
            },
            {
                title: "Post-departure Cleanup",
                description: "Archive data, update org charts",
                daysFromStart: 1,
                responsibleRole: "hr"
            }
        ]
    }
];
function getWorkflowTemplates() {
    return WORKFLOW_TEMPLATES;
}
function getTemplateById(id) {
    return WORKFLOW_TEMPLATES.find((t)=>t.id === id);
}
async function startWorkflow(templateId, employeeId, createdBy, notes) {
    const template = getTemplateById(templateId);
    if (!template) return null;
    const { data: employee } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("name").eq("id", employeeId).single();
    const now = new Date();
    const steps = template.defaultSteps.map((step, index)=>({
            id: `step-${index + 1}`,
            title: step.title,
            description: step.description,
            daysFromStart: step.daysFromStart,
            responsibleRole: step.responsibleRole,
            isCompleted: false
        }));
    const maxDays = Math.max(...template.defaultSteps.map((s)=>s.daysFromStart));
    const dueDate = new Date(now.getTime() + maxDays * 24 * 60 * 60 * 1000);
    const instanceData = {
        template_id: templateId,
        template_name: template.name,
        employee_id: employeeId,
        employee_name: employee?.name || null,
        started_at: now.toISOString(),
        due_date: dueDate.toISOString().split("T")[0],
        status: "active",
        steps: steps,
        created_by: createdBy || null,
        notes: notes || null
    };
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("hr_workflow_instances").insert(instanceData).select().single();
    if (error || !data) {
        console.error("Failed to start workflow:", error);
        return null;
    }
    return mapInstanceFromDb(data);
}
async function getWorkflowInstances(filters) {
    let query = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("hr_workflow_instances").select("*").order("started_at", {
        ascending: false
    });
    if (filters?.status) {
        query = query.eq("status", filters.status);
    }
    if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
    }
    if (filters?.templateId) {
        query = query.eq("template_id", filters.templateId);
    }
    const { data, error } = await query;
    if (error || !data) return [];
    return data.map(mapInstanceFromDb);
}
async function getWorkflowById(id) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("hr_workflow_instances").select("*").eq("id", id).single();
    if (error || !data) return null;
    return mapInstanceFromDb(data);
}
async function completeWorkflowStep(instanceId, stepId, completedBy, notes) {
    const instance = await getWorkflowById(instanceId);
    if (!instance) return false;
    const updatedSteps = instance.steps.map((step)=>{
        if (step.id === stepId) {
            return {
                ...step,
                isCompleted: true,
                completedAt: new Date().toISOString(),
                completedBy,
                notes
            };
        }
        return step;
    });
    const allCompleted = updatedSteps.every((s)=>s.isCompleted);
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("hr_workflow_instances").update({
        steps: updatedSteps,
        status: allCompleted ? "completed" : "active",
        completed_at: allCompleted ? new Date().toISOString() : null
    }).eq("id", instanceId);
    return !error;
}
async function cancelWorkflow(instanceId) {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("hr_workflow_instances").update({
        status: "cancelled"
    }).eq("id", instanceId);
    return !error;
}
function mapInstanceFromDb(row) {
    return {
        id: row.id,
        templateId: row.template_id,
        templateName: row.template_name,
        employeeId: row.employee_id,
        employeeName: row.employee_name,
        startedAt: row.started_at,
        dueDate: row.due_date,
        status: row.status,
        steps: row.steps || [],
        createdBy: row.created_by,
        completedAt: row.completed_at,
        notes: row.notes
    };
}
}),
"[project]/app/api/workflows/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$hrWorkflows$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/hrWorkflows.ts [app-route] (ecmascript)");
;
;
;
// In-memory storage for workflow instances (development workaround for Supabase schema cache)
const workflowInstances = [];
async function GET() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(workflowInstances);
}
async function POST(request) {
    try {
        const body = await request.json();
        const { templateId, employeeId } = body;
        if (!templateId || !employeeId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "templateId and employeeId are required"
            }, {
                status: 400
            });
        }
        const template = __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$hrWorkflows$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["WORKFLOW_TEMPLATES"].find((t)=>t.id === templateId);
        if (!template) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Template not found"
            }, {
                status: 404
            });
        }
        const { data: employee } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("name").eq("id", employeeId).single();
        const now = new Date();
        const steps = template.defaultSteps.map((step, index)=>({
                id: `step-${index + 1}`,
                title: step.title,
                description: step.description,
                daysFromStart: step.daysFromStart,
                responsibleRole: step.responsibleRole,
                isCompleted: false
            }));
        const id = `wf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const instance = {
            id,
            templateId: templateId,
            templateName: template.name,
            employeeId,
            employeeName: employee?.name,
            status: "active",
            startedAt: now.toISOString(),
            steps
        };
        workflowInstances.push(instance);
        // Create person_events for workflow steps
        const personEvents = template.defaultSteps.map((step)=>{
            const dueDate = new Date(now.getTime() + step.daysFromStart * 24 * 60 * 60 * 1000);
            return {
                employee_id: employeeId,
                event_type: "training",
                title: `[${template.name}] ${step.title}`,
                description: step.description,
                due_date: dueDate.toISOString().split("T")[0],
                status: "pending"
            };
        });
        const { error: eventsError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("person_events").insert(personEvents);
        if (eventsError) {
            console.warn("Failed to create person_events:", eventsError.message);
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(instance);
    } catch (err) {
        console.error("Workflow creation error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Internal server error"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__0bf5ecc0._.js.map