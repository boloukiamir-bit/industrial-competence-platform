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
        const allCookies = cookieStore.getAll();
        // Debug: log all cookie names
        console.log("[orgSession] Available cookies:", allCookies.map((c)=>c.name));
        // Try standard cookie name first
        let sbAccessToken = cookieStore.get("sb-access-token")?.value;
        // Try project-specific cookie (sb-<project-ref>-auth-token)
        if (!sbAccessToken) {
            const authCookie = allCookies.find((c)=>c.name.startsWith("sb-") && c.name.endsWith("-auth-token"));
            if (authCookie?.value) {
                console.log("[orgSession] Found auth cookie:", authCookie.name);
                try {
                    // Supabase stores session as JSON with access_token field
                    const parsed = JSON.parse(authCookie.value);
                    sbAccessToken = parsed.access_token || parsed[0]?.access_token;
                    console.log("[orgSession] Parsed access_token:", sbAccessToken ? "found" : "not found");
                } catch  {
                    // If not JSON, try using the value directly
                    sbAccessToken = authCookie.value;
                }
            }
        }
        // Also try base64 encoded session cookie format
        if (!sbAccessToken) {
            const sessionCookie = allCookies.find((c)=>c.name.includes("supabase") || c.name.startsWith("sb-") && c.name.includes("auth"));
            if (sessionCookie?.value) {
                console.log("[orgSession] Trying session cookie:", sessionCookie.name);
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
"[project]/app/api/workflows/templates/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__,
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$orgSession$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
const VALID_CATEGORIES = [
    "Production",
    "Safety",
    "HR",
    "Quality",
    "Maintenance",
    "Competence"
];
const VALID_OWNER_ROLES = [
    "HR",
    "Supervisor",
    "IT",
    "Quality",
    "Maintenance",
    "Employee"
];
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
        const templatesResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT id, name, description, category, is_active, created_at 
       FROM wf_templates 
       WHERE org_id = $1 AND is_active = true 
       ORDER BY name`, [
            orgId
        ]);
        const templates = await Promise.all(templatesResult.rows.map(async (template)=>{
            const stepsResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT id, step_no, title, owner_role, default_due_days, required 
           FROM wf_template_steps 
           WHERE template_id = $1 
           ORDER BY step_no`, [
                template.id
            ]);
            return {
                ...template,
                stepCount: stepsResult.rows.length,
                steps: stepsResult.rows
            };
        }));
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            templates
        });
    } catch (err) {
        console.error("Templates error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to fetch templates"
        }, {
            status: 500
        });
    }
}
async function POST(request) {
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
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
                error: "Only admins and HR can create templates"
            }, {
                status: 403
            });
        }
        const body = await request.json();
        const { name, category, description, steps } = body;
        if (!name || !name.trim()) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "Template name is required"
            }, {
                status: 400
            });
        }
        if (!category || !VALID_CATEGORIES.includes(category)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`
            }, {
                status: 400
            });
        }
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "At least one step is required"
            }, {
                status: 400
            });
        }
        for(let i = 0; i < steps.length; i++){
            const step = steps[i];
            if (!step.title || !step.title.trim()) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Step ${i + 1} title is required`
                }, {
                    status: 400
                });
            }
            if (!step.owner_role || !VALID_OWNER_ROLES.includes(step.owner_role)) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Step ${i + 1} owner_role must be one of: ${VALID_OWNER_ROLES.join(", ")}`
                }, {
                    status: 400
                });
            }
            if (step.step_no !== i + 1) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Step numbers must be continuous starting from 1"
                }, {
                    status: 400
                });
            }
            if (typeof step.default_due_days !== "number" || step.default_due_days < 0) {
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: `Step ${i + 1} due days must be a non-negative number`
                }, {
                    status: 400
                });
            }
        }
        await client.query("BEGIN");
        const templateResult = await client.query(`INSERT INTO wf_templates (org_id, name, description, category, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`, [
            orgId,
            name.trim(),
            description?.trim() || null,
            category
        ]);
        const templateId = templateResult.rows[0].id;
        for (const step of steps){
            await client.query(`INSERT INTO wf_template_steps (template_id, step_no, title, description, owner_role, default_due_days, required)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                templateId,
                step.step_no,
                step.title.trim(),
                step.description?.trim() || null,
                step.owner_role,
                step.default_due_days || 0,
                step.required ?? false
            ]);
        }
        await client.query(`INSERT INTO wf_audit_log (org_id, entity_type, entity_id, action, actor_user_id, metadata)
       VALUES ($1, 'template', $2, 'created', $3, $4)`, [
            orgId,
            templateId,
            userId,
            JSON.stringify({
                name,
                category,
                stepCount: steps.length
            })
        ]);
        await client.query("COMMIT");
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            templateId,
            message: "Template created successfully"
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Create template error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to create template"
        }, {
            status: 500
        });
    } finally{
        client.release();
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3dc15f2b._.js.map