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
"[project]/app/api/spaljisten/dashboard/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
async function GET(request) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const areaId = searchParams.get("areaId") || undefined;
        const stationId = searchParams.get("stationId") || undefined;
        const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
        try {
            const [areasRes, stationsRes, employeesRes, skillsRes, ratingsRes] = await Promise.all([
                client.query("SELECT id, org_id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, area_id, station_code, station_name FROM sp_stations WHERE org_id = $1 ORDER BY station_name", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, employee_id, employee_name, is_active FROM sp_employees WHERE org_id = $1 AND is_active = true", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, skill_id, skill_name, station_id FROM sp_skills WHERE org_id = $1", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, employee_id, skill_id, rating FROM sp_employee_skills WHERE org_id = $1", [
                    SPALJISTEN_ORG_ID
                ])
            ]);
            const areas = areasRes.rows;
            const stations = stationsRes.rows;
            const employees = employeesRes.rows;
            const skills = skillsRes.rows;
            const ratings = ratingsRes.rows;
            const totalEmployees = employees.length;
            const totalStations = stations.length;
            const totalSkills = skills.length;
            const independentRatings = ratings.filter((r)=>r.rating !== null && r.rating >= 3);
            const totalRatings = ratings.filter((r)=>r.rating !== null).length;
            const averageIndependentRate = totalRatings > 0 ? Math.round(independentRatings.length / totalRatings * 100) : 0;
            const kpis = {
                totalEmployees,
                totalStations,
                totalSkills,
                averageIndependentRate
            };
            const stationRisks = [];
            for (const station of stations){
                const stationSkills = skills.filter((s)=>s.station_id === station.id);
                if (stationSkills.length === 0) continue;
                const skillIds = stationSkills.map((s)=>s.skill_id);
                const stationRatings = ratings.filter((r)=>skillIds.includes(r.skill_id) && r.rating !== null && r.rating >= 3);
                const independentCount = stationRatings.length;
                const riskScore = stationSkills.length - independentCount;
                stationRisks.push({
                    stationCode: station.station_code,
                    stationName: station.station_name,
                    independentCount,
                    totalSkills: stationSkills.length,
                    riskScore
                });
            }
            const topRiskStations = stationRisks.sort((a, b)=>b.riskScore - a.riskScore).slice(0, 10);
            let filteredStations = stations;
            if (areaId) filteredStations = filteredStations.filter((s)=>s.area_id === areaId);
            if (stationId) filteredStations = filteredStations.filter((s)=>s.id === stationId);
            const filteredStationIds = new Set(filteredStations.map((s)=>s.id));
            const filteredSkills = skills.filter((s)=>filteredStationIds.has(s.station_id));
            const stationMap = new Map(stations.map((s)=>[
                    s.id,
                    s
                ]));
            const employeeMap = new Map(employees.map((e)=>[
                    e.employee_id,
                    e.employee_name
                ]));
            const skillGapData = filteredSkills.map((skill)=>{
                const station = stationMap.get(skill.station_id);
                const skillRatings = ratings.filter((r)=>r.skill_id === skill.skill_id);
                const independentCount = skillRatings.filter((r)=>r.rating !== null && r.rating >= 3).length;
                const totalEmployeesForSkill = skillRatings.length;
                const employeeDetails = skillRatings.map((r)=>({
                        employeeId: r.employee_id,
                        employeeName: employeeMap.get(r.employee_id) || r.employee_id,
                        rating: r.rating
                    }));
                let riskLevel = "ok";
                if (independentCount === 0) riskLevel = "critical";
                else if (independentCount < 2) riskLevel = "warning";
                return {
                    stationCode: station?.station_code || "N/A",
                    stationName: station?.station_name || "Unknown",
                    skillId: skill.skill_id,
                    skillName: skill.skill_name,
                    independentCount,
                    totalEmployees: totalEmployeesForSkill,
                    employees: employeeDetails,
                    riskLevel
                };
            }).sort((a, b)=>{
                const order = {
                    critical: 0,
                    warning: 1,
                    ok: 2
                };
                if (a.riskLevel !== b.riskLevel) return order[a.riskLevel] - order[b.riskLevel];
                return a.independentCount - b.independentCount;
            });
            const filterOptions = {
                areas: areas.map((a)=>({
                        id: a.id,
                        areaCode: a.area_code,
                        areaName: a.area_name
                    })),
                stations: stations.map((s)=>({
                        id: s.id,
                        stationCode: s.station_code,
                        stationName: s.station_name,
                        areaId: s.area_id
                    }))
            };
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                kpis,
                topRiskStations,
                skillGapData,
                filterOptions
            });
        } finally{
            client.release();
        }
    } catch (error) {
        console.error("Dashboard error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error instanceof Error ? error.message : "Failed to load dashboard"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__82c8a234._.js.map