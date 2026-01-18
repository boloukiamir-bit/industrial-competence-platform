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
"[externals]/pg [external] (pg, esm_import)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

const mod = await __turbopack_context__.y("pg");

__turbopack_context__.n(mod);
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, true);}),
"[project]/lib/pgClient.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__ = __turbopack_context__.i("[externals]/pg [external] (pg, esm_import)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__
]);
[__TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
const pool = new __TURBOPACK__imported__module__$5b$externals$5d2f$pg__$5b$external$5d$__$28$pg$2c$__esm_import$29$__["Pool"]({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("localhost") ? false : {
        rejectUnauthorized: false
    }
});
const __TURBOPACK__default__export__ = pool;
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/lib/orgSession.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "getOrgIdFromSession",
    ()=>getOrgIdFromSession,
    "isAdminOrHr",
    ()=>isAdminOrHr
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
async function getOrgIdFromSession(request) {
    const supabaseUrl = process.env.SUPABASE_URL || ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co");
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM");
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const authHeader = request.headers.get("Authorization");
    let accessToken;
    if (authHeader?.startsWith("Bearer ")) {
        accessToken = authHeader.substring(7);
    }
    if (!accessToken) {
        const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
        const sbAccessToken = cookieStore.get("sb-access-token")?.value;
        if (sbAccessToken) {
            accessToken = sbAccessToken;
        }
    }
    if (!accessToken) {
        return {
            success: false,
            error: "Not authenticated - access token required",
            status: 401
        };
    }
    const supabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) {
        return {
            success: false,
            error: "Invalid or expired session",
            status: 401
        };
    }
    const userId = user.id;
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const preferredOrgId = cookieStore.get("current_org_id")?.value;
    let membershipQuery;
    let membershipParams;
    if (preferredOrgId) {
        membershipQuery = `
      SELECT org_id, role 
      FROM memberships 
      WHERE user_id = $1 AND status = 'active' AND org_id = $2
      LIMIT 1
    `;
        membershipParams = [
            userId,
            preferredOrgId
        ];
    } else {
        membershipQuery = `
      SELECT org_id, role 
      FROM memberships 
      WHERE user_id = $1 AND status = 'active'
      ORDER BY created_at ASC
      LIMIT 1
    `;
        membershipParams = [
            userId
        ];
    }
    const membershipResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(membershipQuery, membershipParams);
    if (membershipResult.rows.length === 0) {
        if (preferredOrgId) {
            const fallbackResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT org_id, role FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY created_at ASC LIMIT 1`, [
                userId
            ]);
            if (fallbackResult.rows.length === 0) {
                return {
                    success: false,
                    error: "No active organization membership",
                    status: 403
                };
            }
            return {
                success: true,
                userId,
                orgId: fallbackResult.rows[0].org_id,
                role: fallbackResult.rows[0].role
            };
        }
        return {
            success: false,
            error: "No active organization membership",
            status: 403
        };
    }
    return {
        success: true,
        userId,
        orgId: membershipResult.rows[0].org_id,
        role: membershipResult.rows[0].role
    };
}
function isAdminOrHr(role) {
    return role === "admin" || role === "hr";
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
"[project]/app/api/workflows/setup/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/orgSession.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
async function POST(request) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getOrgIdFromSession"])(request);
        if (!session.success) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: session.error
            }, {
                status: session.status
            });
        }
        const { orgId, role, userId } = session;
        if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isAdminOrHr"])(role)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Only admins and HR can seed templates"
            }, {
                status: 403
            });
        }
        const existingResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT COUNT(*) as count FROM wf_templates WHERE org_id = $1`, [
            orgId
        ]);
        if (parseInt(existingResult.rows[0].count) > 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Templates already exist for this organization. Use force=true to replace them.",
                existingCount: parseInt(existingResult.rows[0].count)
            }, {
                status: 409
            });
        }
        const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
        try {
            await client.query("BEGIN");
            const templateId1 = await seedTemplate(client, orgId, {
                name: "Cross-training Workflow",
                description: "Start cross-training for an employee to address skill gaps at a critical station",
                category: "Competence",
                steps: [
                    {
                        step_no: 1,
                        title: "Identify training needs",
                        description: "Assess current skill level and define target competence",
                        owner_role: "Supervisor",
                        default_due_days: 2,
                        required: true
                    },
                    {
                        step_no: 2,
                        title: "Assign trainer/mentor",
                        description: "Select experienced employee to provide training",
                        owner_role: "Supervisor",
                        default_due_days: 3,
                        required: true
                    },
                    {
                        step_no: 3,
                        title: "Create training schedule",
                        description: "Plan training sessions and timeline",
                        owner_role: "HR",
                        default_due_days: 5,
                        required: true
                    },
                    {
                        step_no: 4,
                        title: "Conduct training",
                        description: "Employee completes hands-on training at station",
                        owner_role: "Supervisor",
                        default_due_days: 14,
                        required: true
                    },
                    {
                        step_no: 5,
                        title: "Assess competence",
                        description: "Evaluate employee skill level after training",
                        owner_role: "Supervisor",
                        default_due_days: 2,
                        required: true
                    },
                    {
                        step_no: 6,
                        title: "Update skill matrix",
                        description: "Record new competence level in system",
                        owner_role: "HR",
                        default_due_days: 1,
                        required: true
                    }
                ]
            });
            const templateId2 = await seedTemplate(client, orgId, {
                name: "Onboarding - New Employee",
                description: "Standard onboarding process for new employees",
                category: "HR",
                steps: [
                    {
                        step_no: 1,
                        title: "Prepare workstation",
                        description: "Set up computer, desk, and access cards",
                        owner_role: "HR",
                        default_due_days: 1,
                        required: true
                    },
                    {
                        step_no: 2,
                        title: "IT account setup",
                        description: "Create email, system accounts, and permissions",
                        owner_role: "IT",
                        default_due_days: 2,
                        required: true
                    },
                    {
                        step_no: 3,
                        title: "Safety training",
                        description: "Complete mandatory safety orientation",
                        owner_role: "Supervisor",
                        default_due_days: 3,
                        required: true
                    },
                    {
                        step_no: 4,
                        title: "Equipment training",
                        description: "Train on primary equipment and tools",
                        owner_role: "Supervisor",
                        default_due_days: 7,
                        required: true
                    },
                    {
                        step_no: 5,
                        title: "Meet the team",
                        description: "Introduction to team members and key contacts",
                        owner_role: "Supervisor",
                        default_due_days: 3,
                        required: true
                    },
                    {
                        step_no: 6,
                        title: "HR documentation",
                        description: "Complete all employment paperwork",
                        owner_role: "HR",
                        default_due_days: 5,
                        required: true
                    },
                    {
                        step_no: 7,
                        title: "First week check-in",
                        description: "Manager check-in after first week",
                        owner_role: "Supervisor",
                        default_due_days: 7,
                        required: true
                    },
                    {
                        step_no: 8,
                        title: "30-day review",
                        description: "Performance review at 30 days",
                        owner_role: "Supervisor",
                        default_due_days: 30,
                        required: true
                    }
                ]
            });
            const templateId3 = await seedTemplate(client, orgId, {
                name: "Incident Response",
                description: "Handle and follow up on safety incidents and near-misses",
                category: "Safety",
                steps: [
                    {
                        step_no: 1,
                        title: "Incident report",
                        description: "Document incident details and immediate response",
                        owner_role: "Supervisor",
                        default_due_days: 0,
                        required: true
                    },
                    {
                        step_no: 2,
                        title: "Root cause analysis",
                        description: "Investigate and identify root causes",
                        owner_role: "Supervisor",
                        default_due_days: 3,
                        required: true
                    },
                    {
                        step_no: 3,
                        title: "Corrective actions",
                        description: "Define and implement corrective measures",
                        owner_role: "Supervisor",
                        default_due_days: 7,
                        required: true
                    },
                    {
                        step_no: 4,
                        title: "Follow-up verification",
                        description: "Verify corrective actions are effective",
                        owner_role: "Supervisor",
                        default_due_days: 14,
                        required: true
                    },
                    {
                        step_no: 5,
                        title: "Close case",
                        description: "Document outcomes and close case",
                        owner_role: "HR",
                        default_due_days: 1,
                        required: true
                    }
                ]
            });
            await client.query(`INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
         VALUES ($1, 'setup', $2, 'templates_seeded', $3, $4)`, [
                orgId,
                orgId,
                userId,
                JSON.stringify({
                    templateCount: 3,
                    templateIds: [
                        templateId1,
                        templateId2,
                        templateId3
                    ]
                })
            ]);
            await client.query("COMMIT");
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                success: true,
                message: "Templates seeded successfully",
                templates: [
                    {
                        id: templateId1,
                        name: "Cross-training Workflow"
                    },
                    {
                        id: templateId2,
                        name: "Onboarding - New Employee"
                    },
                    {
                        id: templateId3,
                        name: "Incident Response"
                    }
                ]
            });
        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally{
            client.release();
        }
    } catch (err) {
        console.error("Setup error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to seed templates"
        }, {
            status: 500
        });
    }
}
async function seedTemplate(client, orgId, template) {
    const result = await client.query(`INSERT INTO wf_templates (org_id, name, description, category, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id`, [
        orgId,
        template.name,
        template.description,
        template.category
    ]);
    const templateId = result.rows[0].id;
    for (const step of template.steps){
        await client.query(`INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            templateId,
            step.step_no,
            step.title,
            step.description,
            step.owner_role,
            step.default_due_days,
            step.required
        ]);
    }
    return templateId;
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e8236aa4._.js.map