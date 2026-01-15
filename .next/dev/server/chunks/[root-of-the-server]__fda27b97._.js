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
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

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
"[project]/app/api/spaljisten/import/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

return __turbopack_context__.a(async (__turbopack_handle_async_dependencies__, __turbopack_async_result__) => { try {

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$papaparse$2f$papaparse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/papaparse/papaparse.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/pgClient.ts [app-route] (ecmascript)");
var __turbopack_async_dependencies__ = __turbopack_handle_async_dependencies__([
    __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__
]);
[__TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__] = __turbopack_async_dependencies__.then ? (await __turbopack_async_dependencies__)() : __turbopack_async_dependencies__;
;
;
;
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
async function importAreas(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const areaCode = row["area_code"]?.trim() || row["code"]?.trim();
            const areaName = row["area_name"]?.trim() || row["name"]?.trim();
            if (!areaCode) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing area_code"
                });
                continue;
            }
            if (!areaName) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing area_name"
                });
                continue;
            }
            try {
                const existing = await client.query("SELECT id FROM sp_areas WHERE org_id = $1 AND area_code = $2", [
                    SPALJISTEN_ORG_ID,
                    areaCode
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_areas SET area_name = $1 WHERE id = $2", [
                        areaName,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_areas (org_id, area_code, area_name) VALUES ($1, $2, $3)", [
                        SPALJISTEN_ORG_ID,
                        areaCode,
                        areaName
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "areas",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importStations(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const stationCode = row["station_code"]?.trim() || row["code"]?.trim();
            const stationName = row["station_name"]?.trim() || row["name"]?.trim();
            const areaCode = row["area_code"]?.trim() || row["area"]?.trim();
            if (!stationCode) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing station_code"
                });
                continue;
            }
            if (!stationName) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing station_name"
                });
                continue;
            }
            try {
                let areaId = null;
                if (areaCode) {
                    const areaRes = await client.query("SELECT id FROM sp_areas WHERE org_id = $1 AND area_code = $2", [
                        SPALJISTEN_ORG_ID,
                        areaCode
                    ]);
                    areaId = areaRes.rows[0]?.id || null;
                }
                const existing = await client.query("SELECT id FROM sp_stations WHERE org_id = $1 AND station_code = $2", [
                    SPALJISTEN_ORG_ID,
                    stationCode
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_stations SET station_name = $1, area_id = $2 WHERE id = $3", [
                        stationName,
                        areaId,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_stations (org_id, station_code, station_name, area_id) VALUES ($1, $2, $3, $4)", [
                        SPALJISTEN_ORG_ID,
                        stationCode,
                        stationName,
                        areaId
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "stations",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importEmployees(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const employeeId = row["employee_id"]?.trim();
            const employeeName = row["employee_name"]?.trim() || row["name"]?.trim();
            const email = row["email"]?.trim() || null;
            const areaCode = row["area"]?.trim() || row["area_code"]?.trim();
            if (!employeeId) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing employee_id"
                });
                continue;
            }
            if (!employeeName) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing employee_name"
                });
                continue;
            }
            try {
                let areaId = null;
                if (areaCode) {
                    const areaRes = await client.query("SELECT id FROM sp_areas WHERE org_id = $1 AND area_code = $2", [
                        SPALJISTEN_ORG_ID,
                        areaCode
                    ]);
                    areaId = areaRes.rows[0]?.id || null;
                }
                const existing = await client.query("SELECT id FROM sp_employees WHERE org_id = $1 AND employee_id = $2", [
                    SPALJISTEN_ORG_ID,
                    employeeId
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_employees SET employee_name = $1, email = $2, area_id = $3, updated_at = NOW() WHERE id = $4", [
                        employeeName,
                        email,
                        areaId,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_employees (org_id, employee_id, employee_name, email, area_id) VALUES ($1, $2, $3, $4, $5)", [
                        SPALJISTEN_ORG_ID,
                        employeeId,
                        employeeName,
                        email,
                        areaId
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "employees",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importSkillsCatalog(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const skillId = row["skill_id"]?.trim();
            const skillName = row["skill_name"]?.trim() || row["name"]?.trim();
            const stationCode = row["station"]?.trim() || row["station_code"]?.trim();
            const category = row["category"]?.trim() || null;
            if (!skillId) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing skill_id"
                });
                continue;
            }
            if (!skillName) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing skill_name"
                });
                continue;
            }
            try {
                let stationId = null;
                if (stationCode) {
                    const stationRes = await client.query("SELECT id FROM sp_stations WHERE org_id = $1 AND station_code = $2", [
                        SPALJISTEN_ORG_ID,
                        stationCode
                    ]);
                    stationId = stationRes.rows[0]?.id || null;
                }
                const existing = await client.query("SELECT id FROM sp_skills WHERE org_id = $1 AND skill_id = $2", [
                    SPALJISTEN_ORG_ID,
                    skillId
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_skills SET skill_name = $1, station_id = $2, category = $3 WHERE id = $4", [
                        skillName,
                        stationId,
                        category,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_skills (org_id, skill_id, skill_name, station_id, category) VALUES ($1, $2, $3, $4, $5)", [
                        SPALJISTEN_ORG_ID,
                        skillId,
                        skillName,
                        stationId,
                        category
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "skills_catalog",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importEmployeeSkillRatings(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const employeeId = row["employee_id"]?.trim();
            const skillId = row["skill_id"]?.trim();
            const ratingStr = row["rating"]?.trim();
            if (!employeeId) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing employee_id"
                });
                continue;
            }
            if (!skillId) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing skill_id"
                });
                continue;
            }
            let rating = null;
            if (ratingStr && ratingStr !== "N" && ratingStr !== "" && ratingStr !== "-") {
                const parsed = parseInt(ratingStr, 10);
                if (isNaN(parsed) || parsed < 0 || parsed > 4) {
                    failedRows.push({
                        line: lineNum,
                        reason: `Invalid rating: ${ratingStr}`
                    });
                    continue;
                }
                rating = parsed;
            }
            try {
                const existing = await client.query("SELECT id FROM sp_employee_skills WHERE org_id = $1 AND employee_id = $2 AND skill_id = $3", [
                    SPALJISTEN_ORG_ID,
                    employeeId,
                    skillId
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_employee_skills SET rating = $1, updated_at = NOW() WHERE id = $2", [
                        rating,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_employee_skills (org_id, employee_id, skill_id, rating) VALUES ($1, $2, $3, $4)", [
                        SPALJISTEN_ORG_ID,
                        employeeId,
                        skillId,
                        rating
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "employee_skill_ratings",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importAreaLeaders(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const areaCode = row["area_code"]?.trim() || row["area"]?.trim();
            const employeeId = row["employee_id"]?.trim() || row["leader_id"]?.trim();
            const isPrimaryStr = row["is_primary"]?.trim() || "false";
            if (!areaCode) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing area_code"
                });
                continue;
            }
            if (!employeeId) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing employee_id"
                });
                continue;
            }
            try {
                const areaRes = await client.query("SELECT id FROM sp_areas WHERE org_id = $1 AND area_code = $2", [
                    SPALJISTEN_ORG_ID,
                    areaCode
                ]);
                if (areaRes.rows.length === 0) {
                    failedRows.push({
                        line: lineNum,
                        reason: `Area not found: ${areaCode}`
                    });
                    continue;
                }
                const areaId = areaRes.rows[0].id;
                const isPrimary = isPrimaryStr.toLowerCase() === "true" || isPrimaryStr === "1";
                const existing = await client.query("SELECT id FROM sp_area_leaders WHERE org_id = $1 AND area_id = $2 AND employee_id = $3", [
                    SPALJISTEN_ORG_ID,
                    areaId,
                    employeeId
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_area_leaders SET is_primary = $1 WHERE id = $2", [
                        isPrimary,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_area_leaders (org_id, area_id, employee_id, is_primary) VALUES ($1, $2, $3, $4)", [
                        SPALJISTEN_ORG_ID,
                        areaId,
                        employeeId,
                        isPrimary
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "area_leaders",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function importRatingScales(rows) {
    let inserted = 0, updated = 0;
    const failedRows = [];
    const client = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$pgClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].connect();
    try {
        for(let i = 0; i < rows.length; i++){
            const row = rows[i];
            const lineNum = i + 2;
            const levelStr = row["level"]?.trim();
            const label = row["label"]?.trim();
            const description = row["description"]?.trim() || null;
            const color = row["color"]?.trim() || null;
            if (!levelStr) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing level"
                });
                continue;
            }
            if (!label) {
                failedRows.push({
                    line: lineNum,
                    reason: "Missing label"
                });
                continue;
            }
            const level = parseInt(levelStr, 10);
            if (isNaN(level) || level < 0 || level > 4) {
                failedRows.push({
                    line: lineNum,
                    reason: `Invalid level: ${levelStr}`
                });
                continue;
            }
            try {
                const existing = await client.query("SELECT id FROM sp_rating_scales WHERE org_id = $1 AND level = $2", [
                    SPALJISTEN_ORG_ID,
                    level
                ]);
                if (existing.rows.length > 0) {
                    await client.query("UPDATE sp_rating_scales SET label = $1, description = $2, color = $3 WHERE id = $4", [
                        label,
                        description,
                        color,
                        existing.rows[0].id
                    ]);
                    updated++;
                } else {
                    await client.query("INSERT INTO sp_rating_scales (org_id, level, label, description, color) VALUES ($1, $2, $3, $4, $5)", [
                        SPALJISTEN_ORG_ID,
                        level,
                        label,
                        description,
                        color
                    ]);
                    inserted++;
                }
            } catch (err) {
                failedRows.push({
                    line: lineNum,
                    reason: err instanceof Error ? err.message : "Unknown error"
                });
            }
        }
    } finally{
        client.release();
    }
    return {
        success: failedRows.length === 0,
        importType: "rating_scales",
        totalRows: rows.length,
        inserted,
        updated,
        failed: failedRows.length,
        failedRows
    };
}
async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const importType = formData.get("importType");
        if (!file) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "No file provided"
        }, {
            status: 400
        });
        if (!importType) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "No import type specified"
        }, {
            status: 400
        });
        const validTypes = [
            "employees",
            "skills_catalog",
            "employee_skill_ratings",
            "areas",
            "stations",
            "area_leaders",
            "rating_scales"
        ];
        if (!validTypes.includes(importType)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: `Invalid import type. Valid types: ${validTypes.join(", ")}`
            }, {
                status: 400
            });
        }
        const text = await file.text();
        const parsed = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$papaparse$2f$papaparse$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["default"].parse(text, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h)=>h.trim().toLowerCase().replace(/\s+/g, "_")
        });
        if (parsed.errors.length > 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "CSV parsing errors",
                details: parsed.errors.slice(0, 10)
            }, {
                status: 400
            });
        }
        const rows = parsed.data;
        if (rows.length === 0) return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "CSV file is empty"
        }, {
            status: 400
        });
        let result;
        switch(importType){
            case "areas":
                result = await importAreas(rows);
                break;
            case "stations":
                result = await importStations(rows);
                break;
            case "employees":
                result = await importEmployees(rows);
                break;
            case "skills_catalog":
                result = await importSkillsCatalog(rows);
                break;
            case "employee_skill_ratings":
                result = await importEmployeeSkillRatings(rows);
                break;
            case "area_leaders":
                result = await importAreaLeaders(rows);
                break;
            case "rating_scales":
                result = await importRatingScales(rows);
                break;
            default:
                return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                    error: "Unknown import type"
                }, {
                    status: 400
                });
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
    } catch (error) {
        console.error("Import error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error instanceof Error ? error.message : "Import failed"
        }, {
            status: 500
        });
    }
}
__turbopack_async_result__();
} catch(e) { __turbopack_async_result__(e); } }, false);}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__fda27b97._.js.map