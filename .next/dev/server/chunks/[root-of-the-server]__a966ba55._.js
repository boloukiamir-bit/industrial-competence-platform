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
"[project]/app/api/debug/schema/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
;
;
const supabaseAdmin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co"), process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false
    }
});
async function GET(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Unauthorized'
        }, {
            status: 401
        });
    }
    const orgId = request.nextUrl.searchParams.get('orgId');
    if (!orgId) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'orgId required'
        }, {
            status: 400
        });
    }
    const results = {
        tables: {},
        nullOrgIdCounts: {},
        errors: []
    };
    const tablesToCheck = [
        'employees',
        'org_units'
    ];
    for (const table of tablesToCheck){
        try {
            const { data: columnsData, error: columnsError } = await supabaseAdmin.rpc('get_table_columns', {
                table_name: table
            });
            if (columnsError) {
                const { data: fallbackData, error: fallbackError } = await supabaseAdmin.from(table).select('*').limit(1);
                if (fallbackError) {
                    if (fallbackError.code === '42P01') {
                        results.tables[table] = {
                            exists: false,
                            hasOrgId: false,
                            rlsEnabled: null
                        };
                    } else {
                        results.errors.push(`${table}: ${fallbackError.message}`);
                        results.tables[table] = {
                            exists: true,
                            hasOrgId: false,
                            rlsEnabled: null
                        };
                    }
                    continue;
                }
                const hasOrgId = fallbackData && fallbackData.length > 0 ? 'org_id' in fallbackData[0] : true;
                results.tables[table] = {
                    exists: true,
                    hasOrgId,
                    rlsEnabled: null
                };
            } else {
                const columns = Array.isArray(columnsData) ? columnsData : [];
                const hasOrgId = columns.some((c)=>c.column_name === 'org_id');
                results.tables[table] = {
                    exists: true,
                    hasOrgId,
                    rlsEnabled: null
                };
            }
            const { count: nullCount, error: nullError } = await supabaseAdmin.from(table).select('id', {
                count: 'exact',
                head: true
            }).is('org_id', null);
            if (!nullError && nullCount !== null) {
                results.nullOrgIdCounts[table] = nullCount;
            }
        } catch (err) {
            results.errors.push(`${table}: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    }
    try {
        const { data: rlsData, error: rlsError } = await supabaseAdmin.rpc('check_rls_status', {
            table_names: tablesToCheck
        });
        if (!rlsError && rlsData) {
            for (const row of rlsData){
                if (results.tables[row.tablename]) {
                    results.tables[row.tablename].rlsEnabled = row.rowsecurity;
                }
            }
        }
    } catch  {
        for (const table of tablesToCheck){
            if (results.tables[table]) {
                results.tables[table].rlsEnabled = null;
            }
        }
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(results);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a966ba55._.js.map