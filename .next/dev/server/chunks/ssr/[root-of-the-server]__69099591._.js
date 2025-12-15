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
"[project]/lib/supabaseClient.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-rsc] (ecmascript)");
;
const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || "";
const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || "";
function createSupabaseClient() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder");
}
const supabase = createSupabaseClient();
function getSupabaseClient() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return supabase;
}
}),
"[project]/services/competenceService.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getEmployeesWithSkills",
    ()=>getEmployeesWithSkills,
    "getFilterOptions",
    ()=>getFilterOptions,
    "getTomorrowsGaps",
    ()=>getTomorrowsGaps,
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
        isActive: true
    },
    {
        name: "Erik Johansson",
        employeeNumber: "E1002",
        role: "Operator",
        line: "Pressline 1",
        team: "Night",
        isActive: true
    },
    {
        name: "Maria Svensson",
        employeeNumber: "E1003",
        role: "Team Leader",
        line: "Assembly",
        team: "Day",
        isActive: true
    },
    {
        name: "Karl Andersson",
        employeeNumber: "E1004",
        role: "Operator",
        line: "Assembly",
        team: "Night",
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
    const targetDateStr = targetDate.toISOString().split("T")[0];
    const { data: requirements, error: reqError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("competence_requirements").select("*").lte("effective_date", targetDateStr);
    if (reqError) {
        throw new Error(`Failed to fetch competence_requirements: ${reqError.message}`);
    }
    if (!requirements || requirements.length === 0) {
        return [];
    }
    const [employeesResult, skillsResult, employeeSkillsResult] = await Promise.all([
        __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("*").eq("is_active", true),
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
    const employees = employeesResult.data || [];
    const skills = skillsResult.data || [];
    const employeeSkills = employeeSkillsResult.data || [];
    const skillMap = new Map();
    for (const skill of skills){
        skillMap.set(skill.id, {
            code: skill.code,
            name: skill.name
        });
    }
    const employeeSkillMap = new Map();
    for (const es of employeeSkills){
        if (!employeeSkillMap.has(es.employee_id)) {
            employeeSkillMap.set(es.employee_id, new Map());
        }
        employeeSkillMap.get(es.employee_id).set(es.skill_id, es.level);
    }
    const gaps = [];
    for (const req of requirements){
        const { line, team, skill_id, min_level, required_headcount } = req;
        const skillInfo = skillMap.get(skill_id);
        if (!skillInfo) continue;
        const matchingEmployees = employees.filter((emp)=>emp.line === line && emp.team === team);
        let actualHeadcount = 0;
        for (const emp of matchingEmployees){
            const empSkills = employeeSkillMap.get(emp.id);
            const level = empSkills?.get(skill_id) ?? 0;
            if (level >= min_level) {
                actualHeadcount++;
            }
        }
        const missingHeadcount = Math.max(0, required_headcount - actualHeadcount);
        if (missingHeadcount > 0) {
            gaps.push({
                line,
                team,
                skillCode: skillInfo.code,
                skillName: skillInfo.name,
                requiredLevel: min_level,
                requiredHeadcount: required_headcount,
                actualHeadcount,
                missingHeadcount
            });
        }
    }
    return gaps;
}
}),
"[project]/app/app/gaps/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>GapsPage,
    "dynamic",
    ()=>dynamic
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/competenceService.ts [app-rsc] (ecmascript)");
;
;
const dynamic = "force-dynamic";
async function GapsPage() {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    const formattedDate = targetDate.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
    const gaps = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$competenceService$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["getTomorrowsGaps"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                className: "text-2xl font-bold text-gray-900 dark:text-white mb-2",
                "data-testid": "heading-tomorrows-gaps",
                children: "Tomorrow's Gaps"
            }, void 0, false, {
                fileName: "[project]/app/app/gaps/page.tsx",
                lineNumber: 19,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-gray-500 dark:text-gray-400 mb-6",
                "data-testid": "text-target-date",
                children: [
                    "Target date: ",
                    formattedDate
                ]
            }, void 0, true, {
                fileName: "[project]/app/app/gaps/page.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "overflow-x-auto",
                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("table", {
                        className: "w-full",
                        "data-testid": "gaps-table",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("thead", {
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    className: "border-b border-gray-200 dark:border-gray-700",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Line"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 37,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Team"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 40,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-left p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Skill"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 43,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Required Level"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 46,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Required"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 49,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Actual"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 52,
                                            columnNumber: 17
                                        }, this),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("th", {
                                            className: "text-center p-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50",
                                            children: "Missing"
                                        }, void 0, false, {
                                            fileName: "[project]/app/app/gaps/page.tsx",
                                            lineNumber: 55,
                                            columnNumber: 17
                                        }, this)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/app/app/gaps/page.tsx",
                                    lineNumber: 36,
                                    columnNumber: 15
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/app/gaps/page.tsx",
                                lineNumber: 35,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tbody", {
                                children: gaps.length === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                        colSpan: 7,
                                        className: "p-6 text-center text-gray-500 dark:text-gray-400",
                                        "data-testid": "no-gaps-message",
                                        children: "No competence gaps found for tomorrow."
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/gaps/page.tsx",
                                        lineNumber: 63,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/app/app/gaps/page.tsx",
                                    lineNumber: 62,
                                    columnNumber: 17
                                }, this) : gaps.map((gap, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("tr", {
                                        className: `${index < gaps.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""} ${gap.missingHeadcount > 0 ? "bg-red-50 dark:bg-red-900/20" : ""}`,
                                        "data-testid": `row-gap-${index}`,
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-gray-900 dark:text-white",
                                                children: gap.line
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 86,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-gray-900 dark:text-white",
                                                children: gap.team
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 89,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-gray-900 dark:text-white",
                                                        children: gap.skillCode
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/gaps/page.tsx",
                                                        lineNumber: 93,
                                                        columnNumber: 23
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-xs text-gray-500 dark:text-gray-400",
                                                        children: gap.skillName
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/gaps/page.tsx",
                                                        lineNumber: 96,
                                                        columnNumber: 23
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 92,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-center text-gray-900 dark:text-white",
                                                children: gap.requiredLevel
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 100,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-center text-gray-900 dark:text-white",
                                                children: gap.requiredHeadcount
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 103,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-center text-gray-900 dark:text-white",
                                                children: gap.actualHeadcount
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 106,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])("td", {
                                                className: "p-3 text-sm text-center font-medium text-red-600 dark:text-red-400",
                                                children: gap.missingHeadcount
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/gaps/page.tsx",
                                                lineNumber: 109,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, `${gap.line}-${gap.team}-${gap.skillCode}-${index}`, true, {
                                        fileName: "[project]/app/app/gaps/page.tsx",
                                        lineNumber: 73,
                                        columnNumber: 19
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/app/app/gaps/page.tsx",
                                lineNumber: 60,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/app/gaps/page.tsx",
                        lineNumber: 34,
                        columnNumber: 11
                    }, this)
                }, void 0, false, {
                    fileName: "[project]/app/app/gaps/page.tsx",
                    lineNumber: 33,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/app/gaps/page.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/app/gaps/page.tsx",
        lineNumber: 18,
        columnNumber: 5
    }, this);
}
}),
"[project]/app/app/gaps/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/app/gaps/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__69099591._.js.map