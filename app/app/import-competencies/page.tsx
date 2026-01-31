"use client";

import { useState } from "react";
import Link from "next/link";

type SkillsResult = {
  summary?: { inserted: number; updated: number; skipped: number; errors: number };
  errors?: Array<{ rowIndex: number; message: string }>;
  error?: string;
};

type EmployeeSkillsResult = {
  summary?: {
    inserted: number;
    updated: number;
    skipped: {
      unknownEmployee: number;
      unknownSkill: number;
      invalid: number;
    };
  };
  skippedRows?: {
    unknownEmployee: Array<{ rowIndex: number; employee_number: string }>;
    unknownSkill: Array<{ rowIndex: number; skill_code: string }>;
  };
  errors?: Array<{ rowIndex: number; message: string }>;
  error?: string;
};

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const line = (r: (string | number)[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
  const csv = [headers.join(","), ...rows.map((r) => line(r))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function ImportCompetenciesPage() {
  const [skillsFile, setSkillsFile] = useState<File | null>(null);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsResult, setSkillsResult] = useState<SkillsResult | null>(null);

  const [empSkillsFile, setEmpSkillsFile] = useState<File | null>(null);
  const [empSkillsLoading, setEmpSkillsLoading] = useState(false);
  const [empSkillsResult, setEmpSkillsResult] = useState<EmployeeSkillsResult | null>(null);

  async function handleSkillsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!skillsFile) return;
    setSkillsLoading(true);
    setSkillsResult(null);
    try {
      const form = new FormData();
      form.append("file", skillsFile);
      const res = await fetch("/api/competencies/import/skills", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as SkillsResult & { error?: string };
      if (!res.ok) {
        setSkillsResult({ error: data.error ?? "Skills import failed" });
        return;
      }
      setSkillsResult(data);
    } catch (err) {
      setSkillsResult({ error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSkillsLoading(false);
    }
  }

  async function handleEmpSkillsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!empSkillsFile) return;
    setEmpSkillsLoading(true);
    setEmpSkillsResult(null);
    try {
      const form = new FormData();
      form.append("file", empSkillsFile);
      const res = await fetch("/api/competencies/import/employee-skills", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as EmployeeSkillsResult & { error?: string };
      if (!res.ok) {
        setEmpSkillsResult({ error: data.error ?? "Employee-skills import failed" });
        return;
      }
      setEmpSkillsResult(data);
    } catch (err) {
      setEmpSkillsResult({ error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setEmpSkillsLoading(false);
    }
  }

  function downloadSkippedUnknownEmployee() {
    const r = empSkillsResult;
    if (!r?.skippedRows?.unknownEmployee?.length) return;
    const headers = ["row_index", "employee_number", "reason"];
    const rows = r.skippedRows.unknownEmployee.map((x) => [x.rowIndex, x.employee_number, "unknown employee"]);
    downloadCsv("skipped-unknown-employee.csv", headers, rows);
  }

  function downloadSkippedUnknownSkill() {
    const r = empSkillsResult;
    if (!r?.skippedRows?.unknownSkill?.length) return;
    const headers = ["row_index", "skill_code", "reason"];
    const rows = r.skippedRows.unknownSkill.map((x) => [x.rowIndex, x.skill_code, "unknown skill"]);
    downloadCsv("skipped-unknown-skill.csv", headers, rows);
  }

  return (
    <div>
      <h1
        className="text-2xl font-bold text-gray-900 dark:text-white mb-4"
        data-testid="heading-import-competencies"
      >
        Import competencies
      </h1>

      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Upload CSVs for <strong>skills</strong> and <strong>employee skill ratings</strong>. Use the
        Competence Matrix after importing to view skills and levels.
      </p>

      <div className="space-y-8 max-w-2xl">
        <section className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            1. Upload Skills CSV
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Columns: <strong>code</strong>, <strong>name</strong>; optional: <strong>category</strong>,{" "}
            <strong>description</strong>.
          </p>
          <form onSubmit={handleSkillsSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="skills-csv"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                CSV file
              </label>
              <input
                id="skills-csv"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setSkillsFile(e.target.files?.[0] ?? null);
                  setSkillsResult(null);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                data-testid="input-skills-csv"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!skillsFile || skillsLoading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="button-upload-skills"
              >
                {skillsLoading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
          {skillsResult && (
            <div
              className={`mt-4 p-4 rounded-md text-sm ${
                skillsResult.error
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              }`}
              data-testid="skills-result"
            >
              {skillsResult.error ? (
                <p>{skillsResult.error}</p>
              ) : skillsResult.summary ? (
                <>
                  <p className="font-medium">
                    Updated: {skillsResult.summary.updated}, skipped: {skillsResult.summary.skipped}
                    {skillsResult.summary.errors > 0 && `, errors: ${skillsResult.summary.errors}`}
                  </p>
                  {skillsResult.errors && skillsResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {skillsResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>
                          Row {e.rowIndex}: {e.message}
                        </li>
                      ))}
                      {skillsResult.errors.length > 5 && (
                        <li>… and {skillsResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </>
              ) : null}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            2. Upload Employee Skills CSV
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Columns: <strong>employee_number</strong>, <strong>skill_code</strong>,{" "}
            <strong>level</strong> (0–4). Import skills first so codes exist.
          </p>
          <form onSubmit={handleEmpSkillsSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="emp-skills-csv"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                CSV file
              </label>
              <input
                id="emp-skills-csv"
                type="file"
                accept=".csv"
                onChange={(e) => {
                  setEmpSkillsFile(e.target.files?.[0] ?? null);
                  setEmpSkillsResult(null);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300"
                data-testid="input-employee-skills-csv"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!empSkillsFile || empSkillsLoading}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="button-upload-employee-skills"
              >
                {empSkillsLoading ? "Uploading…" : "Upload"}
              </button>
            </div>
          </form>
          {empSkillsResult && (
            <div
              className={`mt-4 p-4 rounded-md text-sm ${
                empSkillsResult.error
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
                  : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
              }`}
              data-testid="employee-skills-result"
            >
              {empSkillsResult.error ? (
                <p>{empSkillsResult.error}</p>
              ) : empSkillsResult.summary ? (
                <>
                  <p className="font-medium">
                    Updated: {empSkillsResult.summary.updated}, skipped: unknown employee{" "}
                    {empSkillsResult.summary.skipped.unknownEmployee}, unknown skill{" "}
                    {empSkillsResult.summary.skipped.unknownSkill}
                    {empSkillsResult.summary.skipped.invalid > 0 &&
                      `, invalid: ${empSkillsResult.summary.skipped.invalid}`}
                  </p>
                  {empSkillsResult.errors && empSkillsResult.errors.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {empSkillsResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>
                          Row {e.rowIndex}: {e.message}
                        </li>
                      ))}
                      {empSkillsResult.errors.length > 5 && (
                        <li>… and {empSkillsResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  )}
                  {(empSkillsResult.skippedRows?.unknownEmployee?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={downloadSkippedUnknownEmployee}
                      className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Download skipped (unknown employee) CSV
                    </button>
                  )}
                  {(empSkillsResult.skippedRows?.unknownSkill?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={downloadSkippedUnknownSkill}
                      className="mt-2 ml-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Download skipped (unknown skill) CSV
                    </button>
                  )}
                </>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 flex gap-2">
        <Link
          href="/app/competence-matrix"
          className="px-4 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          Back to Competence Matrix
        </Link>
      </div>
    </div>
  );
}
