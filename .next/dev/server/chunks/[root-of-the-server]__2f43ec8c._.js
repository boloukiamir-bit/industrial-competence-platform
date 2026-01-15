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
"[project]/lib/env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/lib/supabaseClient.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "isSupabaseReady",
    ()=>isSupabaseReady,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-route] (ecmascript)");
;
;
let supabaseInstance = null;
function createSupabaseClient() {
    const env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getPublicEnv"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(env.supabaseUrl, env.supabaseAnonKey, {
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
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validatePublicEnv"])();
    return validation.valid;
}
}),
"[project]/types/spaljisten.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SPALJISTEN_ORG_ID",
    ()=>SPALJISTEN_ORG_ID
]);
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
}),
"[project]/services/spaljistenDashboard.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAreas",
    ()=>getAreas,
    "getDashboardKPIs",
    ()=>getDashboardKPIs,
    "getEmployees",
    ()=>getEmployees,
    "getFilterOptions",
    ()=>getFilterOptions,
    "getSkillGapData",
    ()=>getSkillGapData,
    "getSkills",
    ()=>getSkills,
    "getStations",
    ()=>getStations,
    "getTopRiskStations",
    ()=>getTopRiskStations
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/types/spaljisten.ts [app-route] (ecmascript)");
;
;
async function getAreas(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_areas").select("id, org_id, area_code, area_name").eq("org_id", orgId).order("area_name");
    if (error) throw error;
    return (data || []).map((a)=>({
            id: a.id,
            orgId: a.org_id,
            areaCode: a.area_code,
            areaName: a.area_name
        }));
}
async function getStations(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], areaId) {
    let query = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_stations").select("id, org_id, area_id, station_code, station_name, sort_order").eq("org_id", orgId).order("station_name");
    if (areaId) {
        query = query.eq("area_id", areaId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((s)=>({
            id: s.id,
            orgId: s.org_id,
            areaId: s.area_id,
            stationCode: s.station_code,
            stationName: s.station_name,
            sortOrder: s.sort_order || 0
        }));
}
async function getSkills(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], stationId) {
    let query = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_skills").select("id, org_id, skill_id, skill_name, station_id, category, description, sort_order").eq("org_id", orgId).order("skill_name");
    if (stationId) {
        query = query.eq("station_id", stationId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((s)=>({
            id: s.id,
            orgId: s.org_id,
            skillId: s.skill_id,
            skillName: s.skill_name,
            stationId: s.station_id,
            category: s.category,
            description: s.description,
            sortOrder: s.sort_order || 0
        }));
}
async function getEmployees(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], areaId) {
    let query = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employees").select("id, org_id, employee_id, employee_name, email, area_id, employment_type, is_active").eq("org_id", orgId).eq("is_active", true).order("employee_name");
    if (areaId) {
        query = query.eq("area_id", areaId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((e)=>({
            id: e.id,
            orgId: e.org_id,
            employeeId: e.employee_id,
            employeeName: e.employee_name,
            email: e.email,
            areaId: e.area_id,
            employmentType: e.employment_type,
            isActive: e.is_active
        }));
}
async function getDashboardKPIs(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]) {
    const [employeesRes, stationsRes, skillsRes, ratingsRes] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employees").select("id", {
            count: "exact",
            head: true
        }).eq("org_id", orgId).eq("is_active", true),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_stations").select("id", {
            count: "exact",
            head: true
        }).eq("org_id", orgId),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_skills").select("id", {
            count: "exact",
            head: true
        }).eq("org_id", orgId),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employee_skills").select("rating").eq("org_id", orgId).gte("rating", 3)
    ]);
    const totalEmployees = employeesRes.count || 0;
    const totalStations = stationsRes.count || 0;
    const totalSkills = skillsRes.count || 0;
    const totalRatingsRes = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employee_skills").select("id", {
        count: "exact",
        head: true
    }).eq("org_id", orgId).not("rating", "is", null);
    const independentCount = ratingsRes.data?.length || 0;
    const totalRatings = totalRatingsRes.count || 1;
    const averageIndependentRate = Math.round(independentCount / totalRatings * 100);
    return {
        totalEmployees,
        totalStations,
        totalSkills,
        averageIndependentRate
    };
}
async function getTopRiskStations(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], limit = 10) {
    const { data: stations } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_stations").select("id, station_code, station_name").eq("org_id", orgId);
    if (!stations || stations.length === 0) return [];
    const stationRisks = [];
    for (const station of stations){
        const { data: skills } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_skills").select("skill_id").eq("org_id", orgId).eq("station_id", station.id);
        if (!skills || skills.length === 0) continue;
        const skillIds = skills.map((s)=>s.skill_id);
        const { data: ratings } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employee_skills").select("skill_id, rating").eq("org_id", orgId).in("skill_id", skillIds).gte("rating", 3);
        const independentCount = ratings?.length || 0;
        const totalSkills = skills.length;
        const riskScore = totalSkills - independentCount;
        stationRisks.push({
            stationCode: station.station_code,
            stationName: station.station_name,
            independentCount,
            totalSkills,
            riskScore
        });
    }
    return stationRisks.sort((a, b)=>b.riskScore - a.riskScore).slice(0, limit);
}
async function getSkillGapData(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], areaId, stationId) {
    let stationQuery = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_stations").select("id, station_code, station_name, area_id").eq("org_id", orgId);
    if (areaId) {
        stationQuery = stationQuery.eq("area_id", areaId);
    }
    if (stationId) {
        stationQuery = stationQuery.eq("id", stationId);
    }
    const { data: stations } = await stationQuery;
    if (!stations || stations.length === 0) return [];
    const stationIds = stations.map((s)=>s.id);
    const { data: skills } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_skills").select("id, skill_id, skill_name, station_id").eq("org_id", orgId).in("station_id", stationIds);
    if (!skills || skills.length === 0) return [];
    const { data: employees } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employees").select("employee_id, employee_name").eq("org_id", orgId).eq("is_active", true);
    const employeeMap = new Map(employees?.map((e)=>[
            e.employee_id,
            e.employee_name
        ]) || []);
    const skillIds = skills.map((s)=>s.skill_id);
    const { data: ratings } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["supabase"].from("sp_employee_skills").select("employee_id, skill_id, rating").eq("org_id", orgId).in("skill_id", skillIds);
    const ratingsBySkill = new Map();
    for (const r of ratings || []){
        if (!ratingsBySkill.has(r.skill_id)) {
            ratingsBySkill.set(r.skill_id, []);
        }
        ratingsBySkill.get(r.skill_id).push({
            employeeId: r.employee_id,
            rating: r.rating
        });
    }
    const stationMap = new Map(stations.map((s)=>[
            s.id,
            s
        ]));
    const gapData = [];
    for (const skill of skills){
        const station = stationMap.get(skill.station_id);
        if (!station) continue;
        const skillRatings = ratingsBySkill.get(skill.skill_id) || [];
        const independentCount = skillRatings.filter((r)=>r.rating !== null && r.rating >= 3).length;
        const totalEmployees = skillRatings.length;
        const employeeDetails = skillRatings.map((r)=>({
                employeeId: r.employeeId,
                employeeName: employeeMap.get(r.employeeId) || r.employeeId,
                rating: r.rating
            }));
        let riskLevel = "ok";
        if (independentCount === 0) {
            riskLevel = "critical";
        } else if (independentCount < 2) {
            riskLevel = "warning";
        }
        gapData.push({
            stationCode: station.station_code,
            stationName: station.station_name,
            skillId: skill.skill_id,
            skillName: skill.skill_name,
            independentCount,
            totalEmployees,
            employees: employeeDetails,
            riskLevel
        });
    }
    return gapData.sort((a, b)=>{
        if (a.riskLevel !== b.riskLevel) {
            const order = {
                critical: 0,
                warning: 1,
                ok: 2
            };
            return order[a.riskLevel] - order[b.riskLevel];
        }
        return a.independentCount - b.independentCount;
    });
}
async function getFilterOptions(orgId = __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]) {
    const [areas, stations] = await Promise.all([
        getAreas(orgId),
        getStations(orgId)
    ]);
    return {
        areas,
        stations
    };
}
}),
"[project]/app/api/spaljisten/dashboard/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$spaljistenDashboard$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/spaljistenDashboard.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/types/spaljisten.ts [app-route] (ecmascript)");
;
;
;
async function GET(request) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const areaId = searchParams.get("areaId") || undefined;
        const stationId = searchParams.get("stationId") || undefined;
        const [kpis, topRiskStations, skillGapData, filterOptions] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$spaljistenDashboard$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDashboardKPIs"])(__TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"]),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$spaljistenDashboard$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getTopRiskStations"])(__TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], 10),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$spaljistenDashboard$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSkillGapData"])(__TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"], areaId, stationId),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$spaljistenDashboard$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getFilterOptions"])(__TURBOPACK__imported__module__$5b$project$5d2f$types$2f$spaljisten$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPALJISTEN_ORG_ID"])
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            kpis,
            topRiskStations,
            skillGapData,
            filterOptions
        });
    } catch (error) {
        console.error("Dashboard error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: error instanceof Error ? error.message : "Failed to load dashboard"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__2f43ec8c._.js.map