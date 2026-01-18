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
"[project]/app/api/workflows/dashboard/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
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
        const activeResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT COUNT(*) as count 
      FROM wf_instances 
      WHERE org_id = $1 AND status = 'active'
    `, [
            orgId
        ]);
        const overdueResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT COUNT(*) as count 
      FROM wf_instance_tasks t
      JOIN wf_instances i ON i.id = t.instance_id
      WHERE i.org_id = $1 
        AND i.status = 'active'
        AND t.status != 'done'
        AND t.due_date < CURRENT_DATE
    `, [
            orgId
        ]);
        const byTemplateResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT 
        wt.name as template_name,
        wt.category,
        COUNT(i.id) as count
      FROM wf_instances i
      LEFT JOIN wf_templates wt ON wt.id = i.template_id
      WHERE i.org_id = $1 AND i.status = 'active'
      GROUP BY wt.name, wt.category
      ORDER BY count DESC
    `, [
            orgId
        ]);
        const recentResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT 
        i.id,
        i.employee_name,
        i.status,
        i.start_date,
        i.due_date,
        i.updated_at,
        i.area_code,
        wt.name as template_name,
        wt.category as template_category,
        (SELECT COUNT(*) FROM wf_instance_tasks WHERE instance_id = i.id) as total_tasks,
        (SELECT COUNT(*) FROM wf_instance_tasks WHERE instance_id = i.id AND status = 'done') as done_tasks
      FROM wf_instances i
      LEFT JOIN wf_templates wt ON wt.id = i.template_id
      WHERE i.org_id = $1
      ORDER BY i.updated_at DESC
      LIMIT 10
    `, [
            orgId
        ]);
        const completedTodayResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT COUNT(*) as count 
      FROM wf_instances 
      WHERE org_id = $1 
        AND status = 'completed'
        AND completed_at::date = CURRENT_DATE
    `, [
            orgId
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            activeWorkflows: parseInt(activeResult.rows[0].count),
            overdueTasks: parseInt(overdueResult.rows[0].count),
            completedToday: parseInt(completedTodayResult.rows[0].count),
            byTemplate: byTemplateResult.rows.map((row)=>({
                    templateName: row.template_name || "Unknown",
                    category: row.category,
                    count: parseInt(row.count)
                })),
            recentInstances: recentResult.rows.map((row)=>({
                    id: row.id,
                    employeeName: row.employee_name,
                    status: row.status,
                    startDate: row.start_date,
                    dueDate: row.due_date,
                    updatedAt: row.updated_at,
                    areaCode: row.area_code,
                    templateName: row.template_name,
                    templateCategory: row.template_category,
                    progress: {
                        total: parseInt(row.total_tasks),
                        done: parseInt(row.done_tasks),
                        percent: parseInt(row.total_tasks) > 0 ? Math.round(parseInt(row.done_tasks) / parseInt(row.total_tasks) * 100) : 0
                    }
                }))
        });
    } catch (err) {
        console.error("Dashboard error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to fetch dashboard"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__ece2ff2d._.js.map