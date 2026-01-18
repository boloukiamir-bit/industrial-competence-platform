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
const ORG_NAME = "Spaljisten";
async function GET(request) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const areaCode = searchParams.get("areaCode") || undefined;
        const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
        try {
            const [areasRes, employeesRes, skillsRes, ratingsRes, stationsRes] = await Promise.all([
                client.query("SELECT id, org_id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, employee_id, employee_name, area_id, is_active FROM sp_employees WHERE org_id = $1 AND is_active = true", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, skill_id, skill_name, category, station_id FROM sp_skills WHERE org_id = $1", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, org_id, employee_id, skill_id, rating FROM sp_employee_skills WHERE org_id = $1", [
                    SPALJISTEN_ORG_ID
                ]),
                client.query("SELECT id, area_id, station_code, station_name FROM sp_stations WHERE org_id = $1", [
                    SPALJISTEN_ORG_ID
                ])
            ]);
            const areas = areasRes.rows;
            const employees = employeesRes.rows;
            const skills = skillsRes.rows;
            const ratings = ratingsRes.rows;
            const stations = stationsRes.rows;
            const stationMap = new Map(stations.map((s)=>[
                    s.id,
                    s
                ]));
            const totalEmployees = employees.length;
            const totalSkills = skills.length;
            const totalAreas = areas.length;
            const independentRatings = ratings.filter((r)=>r.rating !== null && r.rating >= 3);
            const totalRatings = ratings.filter((r)=>r.rating !== null).length;
            const averageIndependentRate = totalRatings > 0 ? Math.round(independentRatings.length / totalRatings * 100) : 0;
            const totalStations = stations.length;
            const kpis = {
                totalEmployees,
                totalSkills,
                totalAreas,
                totalStations,
                totalRatings,
                averageIndependentRate,
                orgName: ORG_NAME,
                orgId: SPALJISTEN_ORG_ID
            };
            const employeeMap = new Map(employees.map((e)=>[
                    e.employee_id,
                    {
                        name: e.employee_name,
                        areaId: e.area_id
                    }
                ]));
            const areaMap = new Map(areas.map((a)=>[
                    a.id,
                    a.area_name
                ]));
            const areaCodeToIdMap = new Map(areas.map((a)=>[
                    a.area_code,
                    a.id
                ]));
            let filteredSkills = skills;
            let filteredRatings = ratings;
            if (areaCode) {
                const matchedAreaId = areaCodeToIdMap.get(areaCode);
                if (matchedAreaId) {
                    const employeesInArea = new Set(employees.filter((e)=>e.area_id === matchedAreaId).map((e)=>e.employee_id));
                    filteredRatings = ratings.filter((r)=>employeesInArea.has(r.employee_id));
                    const skillsWithRatingsInArea = new Set(filteredRatings.map((r)=>r.skill_id));
                    filteredSkills = skills.filter((s)=>skillsWithRatingsInArea.has(s.skill_id));
                }
            }
            const skillRisks = [];
            for (const skill of filteredSkills){
                const skillRatings = filteredRatings.filter((r)=>r.skill_id === skill.skill_id);
                const independentCount = skillRatings.filter((r)=>r.rating !== null && r.rating >= 3).length;
                const totalRated = skillRatings.filter((r)=>r.rating !== null).length;
                let riskLevel = "ok";
                if (independentCount === 0) riskLevel = "critical";
                else if (independentCount < 2) riskLevel = "warning";
                skillRisks.push({
                    skillId: skill.skill_id,
                    skillName: skill.skill_name,
                    category: skill.category || "general",
                    independentCount,
                    totalRated,
                    riskLevel
                });
            }
            const topRiskSkills = skillRisks.filter((s)=>s.totalRated > 0).sort((a, b)=>{
                const order = {
                    critical: 0,
                    warning: 1,
                    ok: 2
                };
                if (a.riskLevel !== b.riskLevel) return order[a.riskLevel] - order[b.riskLevel];
                return a.independentCount - b.independentCount;
            }).slice(0, 10);
            const skillGapData = filteredSkills.map((skill)=>{
                const skillRatings = filteredRatings.filter((r)=>r.skill_id === skill.skill_id);
                const independentCount = skillRatings.filter((r)=>r.rating !== null && r.rating >= 3).length;
                const totalEmployeesForSkill = skillRatings.length;
                const employeeDetails = skillRatings.map((r)=>{
                    const emp = employeeMap.get(r.employee_id);
                    return {
                        employeeId: r.employee_id,
                        employeeName: emp?.name || r.employee_id,
                        areaName: emp?.areaId ? areaMap.get(emp.areaId) || "Unknown" : "Unknown",
                        rating: r.rating
                    };
                });
                let riskLevel = "ok";
                if (independentCount === 0) riskLevel = "critical";
                else if (independentCount < 2) riskLevel = "warning";
                return {
                    skillId: skill.skill_id,
                    skillName: skill.skill_name,
                    category: skill.category || "general",
                    independentCount,
                    totalEmployees: totalEmployeesForSkill,
                    employees: employeeDetails,
                    riskLevel
                };
            }).filter((s)=>s.totalEmployees > 0).sort((a, b)=>{
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
                    }))
            };
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                kpis,
                topRiskSkills,
                skillGapTable: skillGapData,
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