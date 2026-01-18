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
"[project]/app/api/spaljisten/admin/dedupe-areas/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
function normalizeAreaCode(raw) {
    return raw.trim().toLowerCase().replace(/\s+/g, "_").replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o");
}
async function POST(request) {
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        await client.query("BEGIN");
        const areasRes = await client.query("SELECT id, area_code, area_name FROM sp_areas WHERE org_id = $1", [
            SPALJISTEN_ORG_ID
        ]);
        const areas = areasRes.rows;
        const areaNameMap = new Map();
        for (const area of areas){
            const normalizedName = area.area_name.trim().toLowerCase();
            const normalizedCode = normalizeAreaCode(area.area_code);
            if (!areaNameMap.has(normalizedName)) {
                areaNameMap.set(normalizedName, {
                    keptId: area.id,
                    keptCode: area.area_code,
                    duplicateIds: []
                });
            } else {
                const existing = areaNameMap.get(normalizedName);
                const existingNormalized = normalizeAreaCode(existing.keptCode);
                if (area.area_code === normalizedCode && existing.keptCode !== existingNormalized) {
                    existing.duplicateIds.push(existing.keptId);
                    existing.keptId = area.id;
                    existing.keptCode = area.area_code;
                } else {
                    existing.duplicateIds.push(area.id);
                }
            }
        }
        let stationsUpdated = 0;
        let employeesUpdated = 0;
        let areasDeleted = 0;
        for (const [, data] of areaNameMap){
            if (data.duplicateIds.length === 0) continue;
            for (const dupId of data.duplicateIds){
                const stationsResult = await client.query("UPDATE sp_stations SET area_id = $1 WHERE area_id = $2 AND org_id = $3", [
                    data.keptId,
                    dupId,
                    SPALJISTEN_ORG_ID
                ]);
                stationsUpdated += stationsResult.rowCount || 0;
                const employeesResult = await client.query("UPDATE sp_employees SET area_id = $1 WHERE area_id = $2 AND org_id = $3", [
                    data.keptId,
                    dupId,
                    SPALJISTEN_ORG_ID
                ]);
                employeesUpdated += employeesResult.rowCount || 0;
                await client.query("DELETE FROM sp_areas WHERE id = $1 AND org_id = $2", [
                    dupId,
                    SPALJISTEN_ORG_ID
                ]);
                areasDeleted++;
            }
        }
        await client.query("COMMIT");
        const finalCount = await client.query("SELECT COUNT(*) as count FROM sp_areas WHERE org_id = $1", [
            SPALJISTEN_ORG_ID
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: true,
            message: "Duplicate areas cleaned up successfully",
            stats: {
                areasDeleted,
                stationsUpdated,
                employeesUpdated,
                finalAreaCount: parseInt(finalCount.rows[0].count)
            }
        });
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Dedupe error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            success: false,
            error: error instanceof Error ? error.message : "Dedupe failed"
        }, {
            status: 500
        });
    } finally{
        client.release();
    }
}
async function GET() {
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        const areasRes = await client.query("SELECT id, area_code, area_name FROM sp_areas WHERE org_id = $1 ORDER BY area_name", [
            SPALJISTEN_ORG_ID
        ]);
        const areas = areasRes.rows;
        const duplicates = [];
        const nameGroups = new Map();
        for (const area of areas){
            const normalizedName = area.area_name.trim().toLowerCase();
            if (!nameGroups.has(normalizedName)) {
                nameGroups.set(normalizedName, []);
            }
            nameGroups.get(normalizedName).push(area.area_code);
        }
        for (const [name, codes] of nameGroups){
            if (codes.length > 1) {
                duplicates.push({
                    area_name: name,
                    codes
                });
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            totalAreas: areas.length,
            duplicateGroups: duplicates.length,
            duplicates,
            areas: areas.map((a)=>({
                    id: a.id,
                    code: a.area_code,
                    name: a.area_name
                }))
        });
    } finally{
        client.release();
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b07cc2fd._.js.map