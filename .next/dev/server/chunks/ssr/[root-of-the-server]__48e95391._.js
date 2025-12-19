module.exports = [
"[project]/lib/env.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/lib/supabaseClient.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "isSupabaseReady",
    ()=>isSupabaseReady,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-rsc] (ecmascript)");
;
;
let supabaseInstance = null;
function createSupabaseClient() {
    const env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getPublicEnv"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])(env.supabaseUrl, env.supabaseAnonKey, {
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
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["validatePublicEnv"])();
    return validation.valid;
}
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"40283ceac9500e8f49cee10418d6ad6684fbd18e4b":"importEmployeesFromCsv"},"",""] */ __turbopack_context__.s([
    "importEmployeesFromCsv",
    ()=>importEmployeesFromCsv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$papaparse$2f$papaparse$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/papaparse/papaparse.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
async function importEmployeesFromCsv(formData) {
    const file = formData.get("file");
    if (!file) {
        return {
            success: false,
            message: "No file provided"
        };
    }
    const text = await file.text();
    const parseResult = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$papaparse$2f$papaparse$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["default"].parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header)=>header.trim().toLowerCase()
    });
    if (parseResult.errors.length > 0) {
        return {
            success: false,
            message: `CSV parsing error: ${parseResult.errors[0].message}`
        };
    }
    const rows = parseResult.data;
    if (rows.length === 0) {
        return {
            success: false,
            message: "CSV file is empty"
        };
    }
    const requiredColumns = [
        "name",
        "employee_number",
        "role",
        "line",
        "team"
    ];
    const headers = Object.keys(rows[0] || {});
    const missingColumns = requiredColumns.filter((col)=>!headers.includes(col));
    if (missingColumns.length > 0) {
        return {
            success: false,
            message: `Missing required columns: ${missingColumns.join(", ")}`
        };
    }
    const employeesToUpsert = [];
    for (const row of rows){
        if (!row.name || !row.employee_number || !row.role || !row.line || !row.team) {
            continue;
        }
        const isActive = row.is_active === undefined || row.is_active === "" || row.is_active.toLowerCase() === "true" || row.is_active === "1";
        employeesToUpsert.push({
            name: row.name.trim(),
            employee_number: row.employee_number.trim(),
            role: row.role.trim(),
            line: row.line.trim(),
            team: row.team.trim(),
            is_active: isActive
        });
    }
    if (employeesToUpsert.length === 0) {
        return {
            success: false,
            message: "No valid employee rows found in CSV"
        };
    }
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").upsert(employeesToUpsert, {
        onConflict: "employee_number"
    });
    if (error) {
        return {
            success: false,
            message: `Database error: ${error.message}`
        };
    }
    return {
        success: true,
        message: `Imported ${employeesToUpsert.length} employees`,
        count: employeesToUpsert.length
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    importEmployeesFromCsv
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(importEmployeesFromCsv, "40283ceac9500e8f49cee10418d6ad6684fbd18e4b", null);
}),
"[project]/.next-internal/server/app/app/import-employees/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$import$2d$employees$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)");
;
}),
"[project]/.next-internal/server/app/app/import-employees/page/actions.js { ACTIONS_MODULE0 => \"[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "40283ceac9500e8f49cee10418d6ad6684fbd18e4b",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$import$2d$employees$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["importEmployeesFromCsv"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$app$2f$import$2d$employees$2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$app$2f$app$2f$import$2d$employees$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/app/import-employees/page/actions.js { ACTIONS_MODULE0 => "[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$import$2d$employees$2f$actions$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/import-employees/actions.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__48e95391._.js.map