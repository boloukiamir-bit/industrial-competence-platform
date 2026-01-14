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
"[project]/app/api/line-overview/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-route] (ecmascript)");
;
;
const DEMO_ORG_ID = "f607f244-da91-41d9-a648-d02a1591105c";
const supabaseAdmin = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createClient"])(("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co"), process.env.SUPABASE_SERVICE_ROLE_KEY);
function shiftParamToDbValue(shift) {
    const map = {
        day: "Day",
        evening: "Evening",
        night: "Night"
    };
    return map[shift.toLowerCase()] || "Day";
}
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
    const shift = shiftParamToDbValue(searchParams.get("shift") || "day");
    try {
        const [linesRes, machinesRes, demandRes, assignmentsRes, attendanceRes, employeesRes] = await Promise.all([
            supabaseAdmin.from("pl_lines").select("*").eq("org_id", DEMO_ORG_ID).order("line_code"),
            supabaseAdmin.from("pl_machines").select("*").eq("org_id", DEMO_ORG_ID).order("machine_code"),
            supabaseAdmin.from("pl_machine_demand").select("*").eq("org_id", DEMO_ORG_ID).eq("plan_date", date).eq("shift_type", shift),
            supabaseAdmin.from("pl_assignment_segments").select("*").eq("org_id", DEMO_ORG_ID).eq("plan_date", date).eq("shift_type", shift),
            supabaseAdmin.from("pl_attendance").select("*").eq("org_id", DEMO_ORG_ID).eq("plan_date", date).eq("shift_type", shift),
            supabaseAdmin.from("pl_employees").select("*").eq("org_id", DEMO_ORG_ID)
        ]);
        if (linesRes.error) throw linesRes.error;
        if (machinesRes.error) throw machinesRes.error;
        if (demandRes.error) throw demandRes.error;
        if (assignmentsRes.error) throw assignmentsRes.error;
        if (attendanceRes.error) throw attendanceRes.error;
        if (employeesRes.error) throw employeesRes.error;
        const lines = linesRes.data || [];
        const machines = machinesRes.data || [];
        const demands = demandRes.data || [];
        const assignments = assignmentsRes.data || [];
        const attendance = attendanceRes.data || [];
        const employees = employeesRes.data || [];
        const demandMap = new Map(demands.map((d)=>[
                d.machine_code,
                d
            ]));
        const employeeMap = new Map(employees.map((e)=>[
                e.employee_code,
                e
            ]));
        const assignmentsByMachine = new Map();
        assignments.forEach((a)=>{
            const list = assignmentsByMachine.get(a.machine_code) || [];
            list.push(a);
            assignmentsByMachine.set(a.machine_code, list);
        });
        const presentCount = attendance.filter((a)=>a.status === "present").length;
        const partialCount = attendance.filter((a)=>a.status === "partial").length;
        const absentCount = attendance.filter((a)=>a.status === "absent").length;
        let totalRequired = 0;
        let totalAssigned = 0;
        let totalGap = 0;
        let totalOverAssigned = 0;
        const lineData = lines.map((line)=>{
            const lineMachines = machines.filter((m)=>m.line_code === line.line_code);
            const machineData = lineMachines.map((machine)=>{
                const demand = demandMap.get(machine.machine_code);
                const machineAssignments = assignmentsByMachine.get(machine.machine_code) || [];
                const requiredHours = demand?.required_hours || 0;
                let assignedHours = 0;
                const assignedPeople = [];
                machineAssignments.forEach((a)=>{
                    const start = new Date(`2000-01-01T${a.start_time}`);
                    const end = new Date(`2000-01-01T${a.end_time}`);
                    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                    assignedHours += hours;
                    const emp = employeeMap.get(a.employee_code);
                    if (emp) {
                        assignedPeople.push({
                            assignmentId: a.id,
                            employeeId: emp.id,
                            employeeCode: emp.employee_code,
                            employeeName: emp.full_name,
                            startTime: a.start_time,
                            endTime: a.end_time,
                            hours
                        });
                    }
                });
                const gap = requiredHours - assignedHours;
                const overAssigned = assignedHours > requiredHours ? assignedHours - requiredHours : 0;
                totalRequired += requiredHours;
                totalAssigned += assignedHours;
                if (gap > 0) totalGap += gap;
                if (overAssigned > 0) totalOverAssigned += overAssigned;
                let status = "no_demand";
                if (requiredHours > 0) {
                    if (assignedHours === 0) status = "gap";
                    else if (assignedHours < requiredHours) status = "partial";
                    else if (assignedHours > requiredHours) status = "over";
                    else status = "ok";
                } else if (assignedHours > 0) {
                    status = "over";
                }
                const assignments = machineAssignments.map((a)=>({
                        id: a.id,
                        planDate: a.plan_date,
                        shiftType: a.shift_type,
                        machineCode: a.machine_code,
                        employeeCode: a.employee_code,
                        startTime: a.start_time,
                        endTime: a.end_time,
                        roleNote: a.role_note
                    }));
                return {
                    machine: {
                        id: machine.id,
                        machineCode: machine.machine_code,
                        machineName: machine.machine_name,
                        lineCode: machine.line_code
                    },
                    requiredHours,
                    assignedHours,
                    gap,
                    overAssigned,
                    status,
                    assignments,
                    assignedPeople
                };
            });
            const lineRequired = machineData.reduce((sum, m)=>sum + m.requiredHours, 0);
            const lineAssigned = machineData.reduce((sum, m)=>sum + m.assignedHours, 0);
            const lineGap = machineData.reduce((sum, m)=>sum + Math.max(0, m.gap), 0);
            const lineOverAssigned = machineData.reduce((sum, m)=>sum + m.overAssigned, 0);
            return {
                line: {
                    id: line.id,
                    lineCode: line.line_code,
                    lineName: line.line_name
                },
                machines: machineData,
                totalRequired: lineRequired,
                totalAssigned: lineAssigned,
                totalGap: lineGap,
                totalOverAssigned: lineOverAssigned
            };
        });
        const hasDemand = totalRequired > 0;
        const coveragePercent = hasDemand ? Math.min(Math.round(totalAssigned / totalRequired * 100), 999) : null;
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            lines: lineData,
            kpis: {
                hasDemand,
                coveragePercent,
                gapHours: hasDemand ? totalGap : null,
                overAssignedHours: totalOverAssigned,
                presentCount,
                partialCount,
                absentCount
            },
            employees: employees.map((e)=>({
                    id: e.id,
                    employeeCode: e.employee_code,
                    fullName: e.full_name
                })),
            attendance: attendance.map((a)=>({
                    id: a.id,
                    employeeCode: a.employee_code,
                    planDate: a.plan_date,
                    shiftType: a.shift_type,
                    status: a.status,
                    availableFrom: a.available_from,
                    availableTo: a.available_to,
                    note: a.note
                }))
        });
    } catch (error) {
        console.error("Line overview fetch error:", error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: "Failed to fetch data"
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__89d7baae._.js.map