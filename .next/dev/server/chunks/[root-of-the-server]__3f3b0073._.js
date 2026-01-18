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

__turbopack_context__.s([
    "getOrgIdFromSession",
    ()=>getOrgIdFromSession,
    "isAdminOrHr",
    ()=>isAdminOrHr
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
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
        const allCookies = cookieStore.getAll();
        // Try standard cookie name first
        let sbAccessToken = cookieStore.get("sb-access-token")?.value;
        // Try project-specific cookie (sb-<project-ref>-auth-token)
        if (!sbAccessToken) {
            const authCookie = allCookies.find((c)=>c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
            if (authCookie?.value) {
                try {
                    const parsed = JSON.parse(authCookie.value);
                    sbAccessToken = parsed.access_token || parsed[0]?.access_token;
                } catch  {
                    sbAccessToken = authCookie.value;
                }
            }
        }
        // Also try base64 encoded session cookie format
        if (!sbAccessToken) {
            const sessionCookie = allCookies.find((c)=>c.name.includes("supabase") || c.name.startsWith("sb-") && c.name.includes("auth"));
            if (sessionCookie?.value) {
                try {
                    const decoded = Buffer.from(sessionCookie.value, 'base64').toString('utf-8');
                    const parsed = JSON.parse(decoded);
                    sbAccessToken = parsed.access_token;
                } catch  {
                // Not base64 encoded
                }
            }
        }
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
    console.log("[orgSession] Authenticated user ID:", userId, "email:", user.email);
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])();
    const preferredOrgId = cookieStore.get("current_org_id")?.value;
    // Query memberships from Supabase (not local pg)
    let membershipQuery = supabase.from("memberships").select("org_id, role").eq("user_id", userId).eq("status", "active").order("created_at", {
        ascending: true
    }).limit(1);
    if (preferredOrgId) {
        membershipQuery = membershipQuery.eq("org_id", preferredOrgId);
    }
    const { data: memberships, error: membershipError } = await membershipQuery;
    console.log("[orgSession] Membership query result:", memberships?.length || 0, "rows", membershipError?.message || "");
    if (!memberships || memberships.length === 0) {
        // Fallback: try without preferred org filter
        if (preferredOrgId) {
            const { data: fallbackMemberships } = await supabase.from("memberships").select("org_id, role").eq("user_id", userId).eq("status", "active").order("created_at", {
                ascending: true
            }).limit(1);
            if (fallbackMemberships && fallbackMemberships.length > 0) {
                return {
                    success: true,
                    userId,
                    orgId: fallbackMemberships[0].org_id,
                    role: fallbackMemberships[0].role
                };
            }
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
        orgId: memberships[0].org_id,
        role: memberships[0].role
    };
}
function isAdminOrHr(role) {
    return role === "admin" || role === "hr";
}
}),
"[project]/app/api/workflows/instances/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/orgSession.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
async function GET(request) {
    try {
        const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getOrgIdFromSession"])(request);
        if (!session.success) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: session.error
            }, {
                status: session.status
            });
        }
        const { orgId } = session;
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get("status");
        let query = `
      SELECT i.id, i.template_id, i.employee_id, i.employee_name, 
             i.status, i.start_date, i.due_date, i.completed_at, i.created_at,
             i.shift_date, i.shift_type, i.area_code,
             t.name as template_name, t.category as template_category
      FROM wf_instances i
      LEFT JOIN wf_templates t ON t.id = i.template_id
      WHERE i.org_id = $1
    `;
        const params = [
            orgId
        ];
        if (status && status !== "all") {
            query += ` AND i.status = $2`;
            params.push(status);
        }
        query += ` ORDER BY i.created_at DESC`;
        const instancesResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(query, params);
        const instances = await Promise.all(instancesResult.rows.map(async (inst)=>{
            const tasksResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT status FROM wf_instance_tasks WHERE instance_id = $1`, [
                inst.id
            ]);
            const totalTasks = tasksResult.rows.length;
            const doneTasks = tasksResult.rows.filter((t)=>t.status === "done").length;
            return {
                id: inst.id,
                templateId: inst.template_id,
                templateName: inst.template_name || "Unknown",
                templateCategory: inst.template_category || "general",
                employeeId: inst.employee_id,
                employeeName: inst.employee_name,
                shiftDate: inst.shift_date,
                shiftType: inst.shift_type,
                areaCode: inst.area_code,
                status: inst.status,
                startDate: inst.start_date,
                dueDate: inst.due_date,
                completedAt: inst.completed_at,
                createdAt: inst.created_at,
                progress: {
                    total: totalTasks,
                    done: doneTasks,
                    percent: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0
                }
            };
        }));
        const countResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT 
         COUNT(*) FILTER (WHERE status = 'active') as active,
         COUNT(*) FILTER (WHERE status = 'completed') as completed,
         COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
       FROM wf_instances WHERE org_id = $1`, [
            orgId
        ]);
        const statusCounts = {
            active: parseInt(countResult.rows[0]?.active || 0),
            completed: parseInt(countResult.rows[0]?.completed || 0),
            cancelled: parseInt(countResult.rows[0]?.cancelled || 0)
        };
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            instances,
            statusCounts
        });
    } catch (err) {
        console.error("Instances error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to fetch instances"
        }, {
            status: 500
        });
    }
}
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
        const { orgId, userId } = session;
        const body = await request.json();
        const { templateId, employeeId, employeeName, startDate, shiftDate, shiftType, areaCode } = body;
        if (!templateId) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "templateId is required"
            }, {
                status: 400
            });
        }
        const templateResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT id, name FROM wf_templates WHERE id = $1 AND org_id = $2`, [
            templateId,
            orgId
        ]);
        if (templateResult.rows.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Template not found"
            }, {
                status: 404
            });
        }
        const template = templateResult.rows[0];
        const stepsResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT step_no, title, description, owner_role, default_due_days, required 
       FROM wf_template_steps 
       WHERE template_id = $1 
       ORDER BY step_no`, [
            templateId
        ]);
        const steps = stepsResult.rows;
        const start = startDate ? new Date(startDate) : new Date();
        const maxDueDays = steps.length > 0 ? Math.max(...steps.map((s)=>s.default_due_days)) : 30;
        const dueDate = new Date(start.getTime() + maxDueDays * 24 * 60 * 60 * 1000);
        const instanceResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`INSERT INTO wf_instances (org_id, template_id, employee_id, employee_name, status, start_date, due_date, shift_date, shift_type, area_code)
       VALUES ($1, $2, $3, $4, 'active', $5, $6, $7, $8, $9)
       RETURNING id`, [
            orgId,
            templateId,
            employeeId || null,
            employeeName || null,
            start.toISOString().split("T")[0],
            dueDate.toISOString().split("T")[0],
            shiftDate || null,
            shiftType || null,
            areaCode || null
        ]);
        const instanceId = instanceResult.rows[0].id;
        for (const step of steps){
            const taskDueDate = new Date(start.getTime() + step.default_due_days * 24 * 60 * 60 * 1000);
            await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`INSERT INTO wf_instance_tasks (instance_id, step_no, title, description, owner_role, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'todo')`, [
                instanceId,
                step.step_no,
                step.title,
                step.description,
                step.owner_role,
                taskDueDate.toISOString().split("T")[0]
            ]);
        }
        await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
       VALUES ($1, 'instance', $2, 'created', $3, $4)`, [
            orgId,
            instanceId,
            userId,
            JSON.stringify({
                templateId,
                templateName: template.name,
                employeeId,
                employeeName,
                taskCount: steps.length
            })
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            instance: {
                id: instanceId,
                templateName: template.name,
                employeeName,
                status: "active",
                taskCount: steps.length
            }
        });
    } catch (err) {
        console.error("Instance creation error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to create instance"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3f3b0073._.js.map