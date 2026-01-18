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
"[project]/app/api/hr/analytics/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
async function getSpaljistenAnalytics() {
    try {
        const employeesResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`SELECT e.id, e.employee_name as name, e.email, a.area_name 
       FROM sp_employees e 
       LEFT JOIN sp_areas a ON e.area_id = a.id
       WHERE e.org_id = $1`, [
            SPALJISTEN_ORG_ID
        ]);
        const employees = employeesResult.rows;
        const totalHeadcount = employees.length;
        const areaData = {};
        for (const emp of employees){
            const area = emp.area_name || "Unassigned";
            if (!areaData[area]) {
                areaData[area] = {
                    count: 0,
                    permanent: 0,
                    temporary: 0,
                    consultant: 0
                };
            }
            areaData[area].count++;
            areaData[area].permanent++;
        }
        const headcountByOrgUnit = Object.entries(areaData).map(([orgUnitName, data])=>({
                orgUnitName,
                count: data.count,
                permanent: data.permanent,
                temporary: data.temporary,
                consultant: data.consultant
            }));
        const skillsResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT 
        sk.skill_name,
        es.rating
      FROM sp_employee_skills es
      JOIN sp_skills sk ON es.skill_id = sk.skill_id
      WHERE es.org_id = $1
      ORDER BY sk.skill_name
    `, [
            SPALJISTEN_ORG_ID
        ]);
        const skillLevels = {};
        for (const row of skillsResult.rows){
            const skillName = row.skill_name || "Unknown";
            if (!skillLevels[skillName]) {
                skillLevels[skillName] = [
                    0,
                    0,
                    0,
                    0,
                    0
                ];
            }
            const level = row.rating;
            if (level >= 0 && level <= 4) {
                skillLevels[skillName][level]++;
            }
        }
        const skillDistribution = Object.entries(skillLevels).slice(0, 10).map(([skillName, levels])=>({
                skillName,
                levels
            }));
        const riskResult = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].query(`
      SELECT 
        st.station_name,
        a.area_name,
        COUNT(DISTINCT CASE WHEN es.rating >= 3 THEN es.employee_id END) as independent_count
      FROM sp_stations st
      LEFT JOIN sp_areas a ON st.area_id = a.id
      LEFT JOIN sp_skills sk ON sk.station_id = st.id
      LEFT JOIN sp_employee_skills es ON es.skill_id = sk.skill_id
      WHERE st.org_id = $1
      GROUP BY st.station_name, a.area_name
    `, [
            SPALJISTEN_ORG_ID
        ]);
        let overdueCount = 0;
        let dueSoonCount = 0;
        const criticalEventsCounts = {};
        for (const row of riskResult.rows){
            const independentCount = parseInt(row.independent_count || "0", 10);
            if (independentCount === 0) {
                overdueCount++;
                criticalEventsCounts["Training"] = (criticalEventsCounts["Training"] || 0) + 1;
            } else if (independentCount < 2) {
                dueSoonCount++;
                criticalEventsCounts["Medical Check"] = (criticalEventsCounts["Medical Check"] || 0) + 1;
            }
        }
        const criticalEventsCount = Object.entries(criticalEventsCounts).map(([category, count])=>({
                category,
                count
            }));
        return {
            totalHeadcount,
            headcountByOrgUnit,
            headcountByEmploymentType: [
                {
                    type: "permanent",
                    count: totalHeadcount
                }
            ],
            sickLeaveRatio: 0,
            temporaryContractsEndingSoon: 0,
            temporaryContractsEndingList: [],
            criticalEventsCount,
            criticalEventsByStatus: {
                overdue: overdueCount,
                dueSoon: dueSoonCount
            },
            skillDistribution,
            riskIndexByUnit: headcountByOrgUnit.map((unit)=>({
                    unitName: unit.orgUnitName,
                    headcount: unit.count,
                    overdueCount: 0,
                    dueSoonCount: 0,
                    riskIndex: 0
                })),
            absencesAvailable: false,
            attritionRisk: {
                highrisk: 0,
                mediumRisk: 0,
                employees: []
            },
            tenureBands: [],
            avgTenureYears: 0,
            openWorkflowsByTemplate: [],
            skillGapSummary: {
                criticalGaps: overdueCount,
                trainingNeeded: dueSoonCount,
                wellStaffed: 0
            }
        };
    } catch (err) {
        console.error("Spaljisten analytics error:", err);
        throw err;
    }
}
async function GET() {
    try {
        const analytics = await getSpaljistenAnalytics();
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(analytics);
    } catch (err) {
        console.error("Analytics API error:", err);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: err instanceof Error ? err.message : "Failed to fetch analytics"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__387d45fa._.js.map