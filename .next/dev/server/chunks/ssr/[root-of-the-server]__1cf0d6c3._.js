module.exports = [
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/app/layout.tsx [app-rsc] (ecmascript)"));
}),
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
"[project]/services/competenceService.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getCriticalGaps",
    ()=>getCriticalGaps,
    "getEmployeesWithSkills",
    ()=>getEmployeesWithSkills,
    "getFilterOptions",
    ()=>getFilterOptions,
    "getOverstaffedSkills",
    ()=>getOverstaffedSkills,
    "getTomorrowsGaps",
    ()=>getTomorrowsGaps,
    "getTrainingPriorities",
    ()=>getTrainingPriorities,
    "seedDemoDataIfEmpty",
    ()=>seedDemoDataIfEmpty
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-rsc] (ecmascript)");
;
const demoEmployees = [
    {
        name: "Anna Lindberg",
        employeeNumber: "E1001",
        role: "Operator",
        line: "Pressline 1",
        team: "Day",
        employmentType: "permanent",
        isActive: true
    },
    {
        name: "Erik Johansson",
        employeeNumber: "E1002",
        role: "Operator",
        line: "Pressline 1",
        team: "Night",
        employmentType: "permanent",
        isActive: true
    },
    {
        name: "Maria Svensson",
        employeeNumber: "E1003",
        role: "Team Leader",
        line: "Assembly",
        team: "Day",
        employmentType: "permanent",
        isActive: true
    },
    {
        name: "Karl Andersson",
        employeeNumber: "E1004",
        role: "Operator",
        line: "Assembly",
        team: "Night",
        employmentType: "temporary",
        isActive: true
    }
];
const demoSkills = [
    {
        code: "PRESS_A",
        name: "Pressline A",
        category: "Production"
    },
    {
        code: "PRESS_B",
        name: "Pressline B",
        category: "Production"
    },
    {
        code: "5S",
        name: "5S Basics",
        category: "Lean"
    },
    {
        code: "SAFETY_BASIC",
        name: "Safety Basic",
        category: "Safety"
    },
    {
        code: "TRUCK_A1",
        name: "Truck A1 License",
        category: "Logistics"
    }
];
const demoSkillLevels = {
    "E1001": {
        "PRESS_A": 3,
        "PRESS_B": 2,
        "5S": 4,
        "SAFETY_BASIC": 3,
        "TRUCK_A1": 1
    },
    "E1002": {
        "PRESS_A": 2,
        "PRESS_B": 1,
        "5S": 3,
        "SAFETY_BASIC": 2,
        "TRUCK_A1": 0
    },
    "E1003": {
        "PRESS_A": 4,
        "PRESS_B": 3,
        "5S": 4,
        "SAFETY_BASIC": 4,
        "TRUCK_A1": 2
    },
    "E1004": {
        "PRESS_A": 1,
        "PRESS_B": 0,
        "5S": 2,
        "SAFETY_BASIC": 1,
        "TRUCK_A1": 0
    }
};
async function seedDemoDataIfEmpty() {
    const { data: existingEmployees, error: checkError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("id").limit(1);
    if (checkError) {
        throw new Error(`Failed to check employees table: ${checkError.message}`);
    }
    if (existingEmployees && existingEmployees.length > 0) {
        return;
    }
    const { data: insertedEmployees, error: employeesError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").insert(demoEmployees.map((emp)=>({
            name: emp.name,
            employee_number: emp.employeeNumber,
            role: emp.role,
            line: emp.line,
            team: emp.team,
            is_active: emp.isActive
        }))).select();
    if (employeesError) {
        throw new Error(`Failed to insert employees: ${employeesError.message}`);
    }
    const { data: insertedSkills, error: skillsError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("skills").insert(demoSkills.map((skill)=>({
            code: skill.code,
            name: skill.name,
            category: skill.category
        }))).select();
    if (skillsError) {
        throw new Error(`Failed to insert skills: ${skillsError.message}`);
    }
    if (!insertedEmployees || !insertedSkills) {
        throw new Error("Failed to get inserted employee or skill IDs");
    }
    const employeeByNumber = new Map();
    for (const emp of insertedEmployees){
        employeeByNumber.set(emp.employee_number, emp.id);
    }
    const skillByCode = new Map();
    for (const skill of insertedSkills){
        skillByCode.set(skill.code, skill.id);
    }
    const employeeSkillsToInsert = [];
    for (const [empNumber, skills] of Object.entries(demoSkillLevels)){
        const employeeId = employeeByNumber.get(empNumber);
        if (!employeeId) continue;
        for (const [skillCode, level] of Object.entries(skills)){
            const skillId = skillByCode.get(skillCode);
            if (!skillId) continue;
            employeeSkillsToInsert.push({
                employee_id: employeeId,
                skill_id: skillId,
                level
            });
        }
    }
    const { error: employeeSkillsError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employee_skills").insert(employeeSkillsToInsert);
    if (employeeSkillsError) {
        throw new Error(`Failed to insert employee_skills: ${employeeSkillsError.message}`);
    }
}
async function getFilterOptions() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("line, team");
    if (error) {
        throw new Error(`Failed to fetch filter options: ${error.message}`);
    }
    const lines = [
        ...new Set((data || []).map((row)=>row.line).filter(Boolean))
    ].sort();
    const teams = [
        ...new Set((data || []).map((row)=>row.team).filter(Boolean))
    ].sort();
    return {
        lines,
        teams
    };
}
async function getEmployeesWithSkills(filters) {
    let employeesQuery = __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("*");
    if (filters?.line) {
        employeesQuery = employeesQuery.eq("line", filters.line);
    }
    if (filters?.team) {
        employeesQuery = employeesQuery.eq("team", filters.team);
    }
    const [employeesResult, skillsResult, employeeSkillsResult] = await Promise.all([
        employeesQuery,
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("skills").select("*"),
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employee_skills").select("*")
    ]);
    if (employeesResult.error) {
        throw new Error(`Failed to fetch employees: ${employeesResult.error.message}`);
    }
    if (skillsResult.error) {
        throw new Error(`Failed to fetch skills: ${skillsResult.error.message}`);
    }
    if (employeeSkillsResult.error) {
        throw new Error(`Failed to fetch employee_skills: ${employeeSkillsResult.error.message}`);
    }
    const employees = (employeesResult.data || []).map((row)=>({
            id: row.id,
            name: row.name,
            employeeNumber: row.employee_number,
            role: row.role,
            line: row.line,
            team: row.team,
            employmentType: row.employment_type || "permanent",
            isActive: row.is_active
        }));
    const skills = (skillsResult.data || []).map((row)=>({
            id: row.id,
            code: row.code,
            name: row.name,
            category: row.category,
            description: row.description
        }));
    const employeeSkills = (employeeSkillsResult.data || []).map((row)=>({
            employeeId: row.employee_id,
            skillId: row.skill_id,
            level: row.level
        }));
    return {
        employees,
        skills,
        employeeSkills
    };
}
async function getTomorrowsGaps() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    const targetDateStr = targetDate.toISOString().slice(0, 10);
    const { data: requirements, error: reqError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("competence_requirements").select("id, line, team, skill_id, min_level, min_headcount, effective_date").lte("effective_date", targetDateStr);
    if (reqError) {
        throw new Error(`Failed to fetch competence_requirements: ${reqError.message}`);
    }
    if (!requirements || requirements.length === 0) {
        return [];
    }
    const skillIds = [
        ...new Set(requirements.map((r)=>r.skill_id))
    ];
    const { data: skills, error: skillsError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("skills").select("id, code, name").in("id", skillIds);
    if (skillsError) {
        throw new Error(`Failed to fetch skills: ${skillsError.message}`);
    }
    const skillMap = new Map();
    for (const skill of skills || []){
        skillMap.set(skill.id, {
            code: skill.code,
            name: skill.name
        });
    }
    const gaps = [];
    for (const req of requirements){
        const { line, team, skill_id, min_level, min_headcount } = req;
        const skillInfo = skillMap.get(skill_id);
        if (!skillInfo) continue;
        const { data: matchingEmployees, error: empError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("id").eq("line", line).eq("team", team);
        if (empError) {
            throw new Error(`Failed to fetch employees for ${line}/${team}: ${empError.message}`);
        }
        const employeeIds = (matchingEmployees || []).map((e)=>e.id);
        let actualHeadcount = 0;
        if (employeeIds.length > 0) {
            const { data: qualifiedSkills, error: esError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employee_skills").select("employee_id").eq("skill_id", skill_id).gte("level", min_level).in("employee_id", employeeIds);
            if (esError) {
                throw new Error(`Failed to fetch employee_skills: ${esError.message}`);
            }
            actualHeadcount = qualifiedSkills?.length || 0;
        }
        const requiredHeadcount = min_headcount;
        const missingHeadcount = Math.max(0, requiredHeadcount - actualHeadcount);
        if (missingHeadcount > 0) {
            gaps.push({
                line,
                team,
                skillCode: skillInfo.code,
                skillName: skillInfo.name,
                requiredLevel: min_level,
                requiredHeadcount,
                actualHeadcount,
                missingHeadcount
            });
        }
    }
    return gaps;
}
function getCriticalGaps(gaps) {
    return gaps.filter((g)=>g.missing > 0).map((g)=>({
            line: g.line_name,
            role: g.role_name,
            skill: g.skill_name,
            missingCount: g.missing
        }));
}
function getTrainingPriorities(skillsStats) {
    return Object.entries(skillsStats).map(([skill, stats])=>({
            skill,
            countLevel0or1: stats.level_0 + stats.level_1
        })).filter((i)=>i.countLevel0or1 > 0).sort((a, b)=>b.countLevel0or1 - a.countLevel0or1);
}
function getOverstaffedSkills(skillsStats) {
    return Object.entries(skillsStats).map(([skill, stats])=>({
            skill,
            countLevel3or4: stats.level_3 + stats.level_4
        })).filter((i)=>i.countLevel3or4 >= 3).sort((a, b)=>b.countLevel3or4 - a.countLevel3or4);
}
}),
"[project]/app/app/competence-matrix/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CompetenceMatrixPage,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/competenceService.ts [app-rsc] (ecmascript)");
;
;
const dynamic = "force-dynamic";
const competenceLevels = [
    {
        value: 0,
        label: "None",
        description: "No experience or training"
    },
    {
        value: 1,
        label: "Basic",
        description: "Theoretical knowledge, needs supervision"
    },
    {
        value: 2,
        label: "Intermediate",
        description: "Can perform with occasional guidance"
    },
    {
        value: 3,
        label: "Advanced",
        description: "Fully independent, can train others"
    },
    {
        value: 4,
        label: "Expert",
        description: "Subject matter expert, defines standards"
    }
];
function getLevelColor(level) {
    switch(level){
        case 0:
            return "bg-gray-200 dark:bg-gray-600";
        case 1:
            return "bg-red-400 dark:bg-red-600";
        case 2:
            return "bg-yellow-400 dark:bg-yellow-500";
        case 3:
            return "bg-green-300 dark:bg-green-500";
        case 4:
            return "bg-green-600 dark:bg-green-700";
        default:
            return "bg-gray-200 dark:bg-gray-600";
    }
}
async function CompetenceMatrixPage({ searchParams }) {
    const params = await searchParams;
    const selectedLine = params.line || "";
    const selectedTeam = params.team || "";
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["seedDemoDataIfEmpty"])();
    const [{ employees, skills, employeeSkills }, filterOptions] = await Promise.all([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getEmployeesWithSkills"])({
            line: selectedLine || undefined,
            team: selectedTeam || undefined
        }),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getFilterOptions"])()
    ]);
    function getSkillLevel(employeeId, skillId) {
        const found = employeeSkills.find((es)=>es.employeeId === employeeId && es.skillId === skillId);
        return found ? found.level : 0;
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-2xl font-bold text-gray-900 dark:text-white mb-6",
                "data-testid": "heading-competence-matrix",
                children: "Competence Matrix"
            }, void 0, false, {
                fileName: "[project]/app/app/competence-matrix/page.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-3",
                        children: "Filters"
                    }, void 0, false, {
                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                        lineNumber: 64,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("form", {
                        method: "GET",
                        className: "flex flex-wrap items-end gap-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: "line-filter",
                                        className: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        children: "Line"
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 69,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        id: "line-filter",
                                        name: "line",
                                        defaultValue: selectedLine,
                                        className: "block w-40 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500",
                                        "data-testid": "select-line-filter",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "All Lines"
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 82,
                                                columnNumber: 15
                                            }, this),
                                            filterOptions.lines.map((line)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: line,
                                                    children: line
                                                }, line, false, {
                                                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                    lineNumber: 84,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 75,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 68,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        htmlFor: "team-filter",
                                        className: "block text-xs text-gray-500 dark:text-gray-400 mb-1",
                                        children: "Team"
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 92,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("select", {
                                        id: "team-filter",
                                        name: "team",
                                        defaultValue: selectedTeam,
                                        className: "block w-40 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500",
                                        "data-testid": "select-team-filter",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                value: "",
                                                children: "All Teams"
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 105,
                                                columnNumber: 15
                                            }, this),
                                            filterOptions.teams.map((team)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("option", {
                                                    value: team,
                                                    children: team
                                                }, team, false, {
                                                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                    lineNumber: 107,
                                                    columnNumber: 17
                                                }, this))
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 98,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 91,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                type: "submit",
                                className: "px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors",
                                "data-testid": "button-apply-filters",
                                children: "Apply Filters"
                            }, void 0, false, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 114,
                                columnNumber: 11
                            }, this),
                            (selectedLine || selectedTeam) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                href: "/app/competence-matrix",
                                className: "px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors",
                                "data-testid": "link-clear-filters",
                                children: "Clear Filters"
                            }, void 0, false, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 123,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                        lineNumber: 67,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/app/competence-matrix/page.tsx",
                lineNumber: 63,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mb-6 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-3",
                        children: "Legend"
                    }, void 0, false, {
                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                        lineNumber: 135,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-4",
                        children: competenceLevels.map((level)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: `w-6 h-6 rounded ${getLevelColor(level.value)}`,
                                        "data-testid": `legend-level-${level.value}`
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 141,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "text-sm",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "font-medium text-gray-900 dark:text-white",
                                                children: [
                                                    level.value,
                                                    " - ",
                                                    level.label
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 146,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "text-gray-500 dark:text-gray-400 ml-1",
                                                children: [
                                                    "(",
                                                    level.description,
                                                    ")"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 149,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 145,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, level.value, true, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 140,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                        lineNumber: 138,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/app/competence-matrix/page.tsx",
                lineNumber: 134,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "overflow-x-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "w-full",
                        "data-testid": "competence-matrix-table",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    className: "border-b border-gray-200 dark:border-gray-700",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Employee"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/competence-matrix/page.tsx",
                                            lineNumber: 163,
                                            columnNumber: 17
                                        }, this),
                                        skills.map((skill)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                                className: "text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 min-w-[100px]",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        children: skill.code
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                        lineNumber: 171,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-xs font-normal text-gray-500 dark:text-gray-400",
                                                        children: skill.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                        lineNumber: 172,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, skill.id, true, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 167,
                                                columnNumber: 19
                                            }, this))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                                    lineNumber: 162,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 161,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: employees.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        colSpan: skills.length + 1,
                                        className: "p-6 text-center text-gray-500 dark:text-gray-400",
                                        "data-testid": "no-results-message",
                                        children: "No employees match the selected filters."
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 182,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                                    lineNumber: 181,
                                    columnNumber: 17
                                }, this) : employees.map((employee, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        className: index < employees.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : "",
                                        "data-testid": `row-employee-${employee.id}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm font-medium text-gray-900 dark:text-white",
                                                        children: employee.name
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                        lineNumber: 202,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-xs text-gray-500 dark:text-gray-400",
                                                        children: [
                                                            employee.role,
                                                            " - ",
                                                            employee.team
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                        lineNumber: 205,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                lineNumber: 201,
                                                columnNumber: 21
                                            }, this),
                                            skills.map((skill)=>{
                                                const level = getSkillLevel(employee.id, skill.id);
                                                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                    className: "p-3 text-center",
                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: `inline-flex items-center justify-center w-8 h-8 rounded text-sm font-medium text-gray-900 dark:text-white ${getLevelColor(level)}`,
                                                        "data-testid": `cell-${employee.id}-${skill.id}`,
                                                        children: level
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                        lineNumber: 213,
                                                        columnNumber: 27
                                                    }, this)
                                                }, skill.id, false, {
                                                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                                                    lineNumber: 212,
                                                    columnNumber: 25
                                                }, this);
                                            })
                                        ]
                                    }, employee.id, true, {
                                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                                        lineNumber: 192,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/app/competence-matrix/page.tsx",
                                lineNumber: 179,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/app/competence-matrix/page.tsx",
                        lineNumber: 160,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/app/competence-matrix/page.tsx",
                    lineNumber: 159,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/app/competence-matrix/page.tsx",
                lineNumber: 158,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/app/competence-matrix/page.tsx",
        lineNumber: 58,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/app/competence-matrix/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/app/competence-matrix/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1cf0d6c3._.js.map