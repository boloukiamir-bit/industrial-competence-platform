"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shield, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { CertificateInfo } from "@/types/domain";
import { useOrg } from "@/hooks/useOrg";

export default function SafetyCertificatesPage() {
  const { currentOrg } = useOrg();
  const [certificates, setCertificates] = useState<CertificateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lineFilter, setLineFilter] = useState("");
  const [skillFilter, setSkillFilter] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [skills, setSkills] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function load() {
      if (!currentOrg) {
        setCertificates([]);
        setLines([]);
        setSkills([]);
        setLoading(false);
        return;
      }
      const [certsRes, linesRes, skillsRes] = await Promise.all([
        supabase
          .from("employee_skills")
          .select(`
            employee_id,
            skill_id,
            level,
            employees!inner(id, name, line, team, is_active),
            skills!inner(id, name, code, category)
          `)
          .eq("employees.org_id", currentOrg.id)
          .in("skills.category", ["safety", "certificate"]),
        fetch("/api/lines", { credentials: "include" }).then(async (r) => {
          const j = await r.json().catch(() => ({}));
          return r.ok && Array.isArray(j.lines) ? j : { lines: [] };
        }),
        supabase.from("skills").select("id, name").in("category", ["safety", "certificate"]),
      ]);

      const employeeIds = [...new Set((certsRes.data || []).map((s: Record<string, unknown>) => {
        const emp = s.employees as Record<string, unknown>;
        return emp?.id as string;
      }).filter(Boolean))];

      let trainingEvents: Record<string, unknown>[] = [];
      if (employeeIds.length > 0) {
        const { data: eventsData } = await supabase
          .from("person_events")
          .select("employee_id, category, completed_date, due_date")
          .eq("category", "training")
          .in("employee_id", employeeIds);
        trainingEvents = eventsData || [];
      }

      const trainingByEmployee = new Map<string, { completedDate?: string; dueDate?: string }>();
      for (const event of trainingEvents) {
        const empId = event.employee_id as string;
        if (!trainingByEmployee.has(empId)) {
          trainingByEmployee.set(empId, {
            completedDate: event.completed_date as string | undefined,
            dueDate: event.due_date as string | undefined,
          });
        } else {
          const existing = trainingByEmployee.get(empId)!;
          if (event.completed_date && (!existing.completedDate || event.completed_date > existing.completedDate)) {
            existing.completedDate = event.completed_date as string;
          }
          if (event.due_date && (!existing.dueDate || event.due_date > existing.dueDate)) {
            existing.dueDate = event.due_date as string;
          }
        }
      }

      const mappedCerts: CertificateInfo[] = (certsRes.data || [])
        .filter((row: Record<string, unknown>) => {
          const emp = row.employees as Record<string, unknown>;
          return emp?.is_active === true;
        })
        .map((row: Record<string, unknown>) => {
          const emp = row.employees as Record<string, unknown>;
          const skill = row.skills as Record<string, unknown>;
          const empId = emp?.id as string;
          const training = trainingByEmployee.get(empId);

          return {
            employeeId: empId,
            employeeName: emp?.name as string,
            line: emp?.line as string,
            team: emp?.team as string,
            skillId: skill?.id as string,
            skillName: skill?.name as string,
            skillCode: skill?.code as string,
            currentLevel: row.level as number,
            latestTrainingDate: training?.completedDate,
            nextDueDate: training?.dueDate,
          };
        });

      setCertificates(mappedCerts);
      const lineList = Array.isArray(linesRes.lines) ? linesRes.lines : [];
      setLines(lineList);
      if ("source" in linesRes && linesRes.source) console.debug("[certificates lines] source:", linesRes.source);
      setSkills((skillsRes.data || []).map((s) => ({ id: s.id, name: s.name })));
      setLoading(false);
    }
    load();
  }, [currentOrg]);

  const filteredCerts = certificates.filter((c) => {
    const matchesLine = !lineFilter || c.line === lineFilter;
    const matchesSkill = !skillFilter || c.skillId === skillFilter;
    return matchesLine && matchesSkill;
  });

  const levelLabels = ["Not trained", "In training", "Can assist", "Trained", "Can train others"];

  function getLevelColor(level: number) {
    if (level >= 3) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    if (level >= 2) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  }

  function getDueStatus(dueDate?: string) {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { status: "overdue", label: "Overdue", color: "text-red-600 dark:text-red-400" };
    if (daysUntil <= 30) return { status: "soon", label: `Due in ${daysUntil}d`, color: "text-yellow-600 dark:text-yellow-400" };
    return { status: "ok", label: due.toLocaleDateString(), color: "text-gray-500 dark:text-gray-400" };
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Safety & Certificates
          </h1>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {filteredCerts.length} records
        </span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          data-testid="select-line-filter"
        >
          <option value="">All Lines</option>
          {lines.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
        <select
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          data-testid="select-skill-filter"
        >
          <option value="">All Certificates</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Employee
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Line / Team
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Certificate
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Level
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Last Training
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Next Due
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredCerts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No certificates found
                </td>
              </tr>
            ) : (
              filteredCerts.map((cert, idx) => {
                const dueStatus = getDueStatus(cert.nextDueDate);
                return (
                  <tr
                    key={`${cert.employeeId}-${cert.skillId}-${idx}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/app/employees/${cert.employeeId}`}
                        className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {cert.employeeName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {cert.line || "-"} / {cert.team || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {cert.skillName}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {cert.skillCode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getLevelColor(cert.currentLevel)}`}>
                        {levelLabels[cert.currentLevel]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                      {cert.latestTrainingDate
                        ? new Date(cert.latestTrainingDate).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {dueStatus ? (
                        <div className="flex items-center gap-1">
                          {dueStatus.status === "overdue" && (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          )}
                          {dueStatus.status === "soon" && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          {dueStatus.status === "ok" && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                          <span className={`text-sm ${dueStatus.color}`}>{dueStatus.label}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
