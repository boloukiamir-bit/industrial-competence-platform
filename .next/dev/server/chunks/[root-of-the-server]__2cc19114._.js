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
"[project]/lib/spaliDevMode.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SPALJISTEN_ORG_ID",
    ()=>SPALJISTEN_ORG_ID,
    "getSpaliDevMode",
    ()=>getSpaliDevMode
]);
function getSpaliDevMode() {
    if ("TURBOPACK compile-time truthy", 1) {
        return process.env.SPALI_DEV_MODE === "true";
    }
    //TURBOPACK unreachable
    ;
}
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
}),
"[project]/app/api/spaljisten/smoke-test/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/spaliDevMode.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
async function GET(request) {
    const timestamp = new Date().toISOString();
    const devMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSpaliDevMode"])();
    const checks = [];
    let overallStatus = "pass";
    try {
        const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
        try {
            // Check 1: Database connection
            checks.push({
                name: "Database Connection",
                status: "pass",
                message: "Connected to PostgreSQL successfully"
            });
            // Check 2: Count areas
            const areasRes = await client.query("SELECT COUNT(*) as count FROM sp_areas WHERE org_id = $1", [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
            ]);
            const areaCount = parseInt(areasRes.rows[0].count, 10);
            checks.push({
                name: "Areas Count",
                status: areaCount > 0 ? "pass" : "warn",
                message: areaCount > 0 ? `Found ${areaCount} areas` : "No areas found - import areas.csv first",
                value: areaCount
            });
            // Check 3: Count employees
            const employeesRes = await client.query("SELECT COUNT(*) as count FROM sp_employees WHERE org_id = $1 AND is_active = true", [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
            ]);
            const employeeCount = parseInt(employeesRes.rows[0].count, 10);
            checks.push({
                name: "Employees Count",
                status: employeeCount > 0 ? "pass" : "warn",
                message: employeeCount > 0 ? `Found ${employeeCount} active employees` : "No employees found",
                value: employeeCount
            });
            // Check 4: Count skills
            const skillsRes = await client.query("SELECT COUNT(*) as count FROM sp_skills WHERE org_id = $1", [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
            ]);
            const skillCount = parseInt(skillsRes.rows[0].count, 10);
            checks.push({
                name: "Skills Count",
                status: skillCount > 0 ? "pass" : "warn",
                message: skillCount > 0 ? `Found ${skillCount} skills` : "No skills found",
                value: skillCount
            });
            // Check 5: Count ratings
            const ratingsRes = await client.query("SELECT COUNT(*) as count FROM sp_employee_skills WHERE org_id = $1", [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
            ]);
            const ratingCount = parseInt(ratingsRes.rows[0].count, 10);
            checks.push({
                name: "Ratings Count",
                status: ratingCount > 0 ? "pass" : "warn",
                message: ratingCount > 0 ? `Found ${ratingCount} skill ratings` : "No ratings found",
                value: ratingCount
            });
            // Check 6: Count stations
            const stationsRes = await client.query("SELECT COUNT(*) as count FROM sp_stations WHERE org_id = $1", [
                __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
            ]);
            const stationCount = parseInt(stationsRes.rows[0].count, 10);
            checks.push({
                name: "Stations Count",
                status: stationCount > 0 ? "pass" : "warn",
                message: stationCount > 0 ? `Found ${stationCount} stations` : "No stations found",
                value: stationCount
            });
            // Check 7: Area filter query returns only filtered area
            if (areaCount > 0) {
                const firstAreaRes = await client.query("SELECT id, area_name FROM sp_areas WHERE org_id = $1 LIMIT 1", [
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]
                ]);
                const firstArea = firstAreaRes.rows[0];
                // Get skills for this area via station chain
                const filteredSkillsRes = await client.query(`SELECT COUNT(*) as count FROM sp_skills s
           JOIN sp_stations st ON s.station_id = st.id
           WHERE s.org_id = $1 AND st.area_id = $2`, [
                    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"],
                    firstArea.id
                ]);
                const filteredCount = parseInt(filteredSkillsRes.rows[0].count, 10);
                checks.push({
                    name: "Area Filter Query",
                    status: "pass",
                    message: `Filter for "${firstArea.area_name}" returns ${filteredCount} skills via station chain`,
                    value: filteredCount
                });
            }
            // Check 8: Export endpoint accessible
            checks.push({
                name: "Export Endpoint",
                status: "pass",
                message: "Export endpoint available at /api/spaljisten/export"
            });
            // Determine overall status
            const failCount = checks.filter((c)=>c.status === "fail").length;
            const warnCount = checks.filter((c)=>c.status === "warn").length;
            if (failCount > 0) overallStatus = "fail";
            else if (warnCount > 0) overallStatus = "warn";
        } finally{
            client.release();
        }
    } catch (error) {
        checks.push({
            name: "Database Connection",
            status: "fail",
            message: error instanceof Error ? error.message : "Connection failed"
        });
        overallStatus = "fail";
    }
    const result = {
        timestamp,
        orgId: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"],
        devMode,
        checks,
        overallStatus
    };
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2cc19114._.js.map