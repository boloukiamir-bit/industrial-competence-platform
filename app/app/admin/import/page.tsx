"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { OrgGuard } from "@/components/OrgGuard";
import { useOrg } from "@/hooks/useOrg";
import { apiPost } from "@/lib/apiClient";
import {
  Upload,
  Table2,
  AlertCircle,
  Check,
  Loader2,
  ChevronLeft,
  FileSpreadsheet,
} from "lucide-react";

type PreviewRow = Record<string, string>;
type PreviewResult = {
  rows: PreviewRow[];
  validRows: PreviewRow[];
  errors: Array<{ rowIndex: number; message: string }>;
  summary: { totalRows: number; validRows: number; errorCount: number };
};
type ApplyResult = {
  success: boolean;
  importRunId?: string;
  summary?: { rowsImported: number; rowsFailed: number; deactivated?: string | null };
  errors?: Array<{ rowIndex: number; message: string }>;
};

function AdminImportContent() {
  const { currentOrg, isAdmin } = useOrg();
  const [file, setFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deactivateNotInFile, setDeactivateNotInFile] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setPreview(null);
    setPreviewError(null);
    setApplyResult(null);
    setApplyError(null);
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setCsvText(String(reader.result ?? ""));
      reader.readAsText(f, "UTF-8");
    } else {
      setCsvText("");
    }
  }, []);

  const handlePreview = useCallback(async () => {
    if (!csvText.trim()) {
      setPreviewError("Upload a CSV file first.");
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    setApplyResult(null);
    try {
      const data = await apiPost<PreviewResult>("/api/import/employees/preview", { csv: csvText });
      setPreview(data);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Preview failed");
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [csvText]);

  const handleApply = useCallback(async () => {
    if (!preview?.validRows?.length) {
      setApplyError("No valid rows to import. Run preview first.");
      return;
    }
    setApplyLoading(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const rows = preview.validRows.map((r) => ({
        employee_number: (r.employee_number ?? "").trim(),
        name: (r.name ?? "").trim(),
      }));
      const data = await apiPost<ApplyResult>("/api/import/employees/apply", {
        rows,
        deactivateNotInFile,
      });
      setApplyResult(data);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Apply failed");
      setApplyResult(null);
    } finally {
      setApplyLoading(false);
    }
  }, [preview?.validRows, deactivateNotInFile]);

  const hasPreview = preview != null;
  const hasErrors = (preview?.errors?.length ?? 0) > 0;
  const canApply = hasPreview && (preview?.summary?.validRows ?? 0) > 0;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/app/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
        >
          <ChevronLeft className="w-4 h-4" />
          Admin
        </Link>
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Import Employees (v1)
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Upload a CSV with columns <strong>employee_number</strong> and <strong>name</strong>.
        Preview shows the first 20 rows and any validation errors. Apply imports into the current
        organization only.
      </p>

      {!currentOrg && (
        <p className="text-amber-600 dark:text-amber-400 mb-4">
          Select an organization to import employees.
        </p>
      )}

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            CSV file
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleFileChange}
              className="block w-full max-w-xs text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-300"
              data-testid="import-csv-input"
            />
            {file && (
              <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <FileSpreadsheet className="w-4 h-4" />
                {file.name}
              </span>
            )}
            <button
              type="button"
              onClick={handlePreview}
              disabled={!csvText.trim() || previewLoading || !currentOrg}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
              data-testid="import-preview-btn"
            >
              {previewLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              Preview
            </button>
          </div>
          {previewError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {previewError}
            </p>
          )}
        </div>

        {hasPreview && (
          <>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Table2 className="w-5 h-5" />
                Summary
              </h2>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Total rows</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">
                    {preview.summary.totalRows}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Valid</dt>
                  <dd className="font-medium text-green-600 dark:text-green-400">
                    {preview.summary.validRows}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Errors</dt>
                  <dd className="font-medium text-red-600 dark:text-red-400">
                    {preview.summary.errorCount}
                  </dd>
                </div>
              </dl>
            </div>

            {hasErrors && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  Validation errors
                </h2>
                <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1 max-h-40 overflow-y-auto">
                  {preview.errors!.slice(0, 50).map((e, i) => (
                    <li key={i}>
                      Row {e.rowIndex}: {e.message}
                    </li>
                  ))}
                  {(preview.errors?.length ?? 0) > 50 && (
                    <li className="text-gray-500">… and {preview.errors!.length - 50} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Preview (first 20 rows)
              </h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-medium text-gray-900 dark:text-white">
                        employee_number
                      </th>
                      <th className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-medium text-gray-900 dark:text-white">
                        name
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="border-b border-gray-200 dark:border-gray-600">
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.employee_number ?? ""}
                        </td>
                        <td className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.name ?? ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={deactivateNotInFile}
                  onChange={(e) => setDeactivateNotInFile(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                  data-testid="import-deactivate-toggle"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Deactivate employees not in file
                </span>
              </label>
              <button
                type="button"
                onClick={handleApply}
                disabled={!canApply || applyLoading || !currentOrg}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:pointer-events-none"
                data-testid="import-apply-btn"
              >
                {applyLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Apply import
              </button>
              {applyError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {applyError}
                </p>
              )}
              {applyResult?.success && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  Imported {applyResult.summary?.rowsImported ?? 0} employees
                  {applyResult.summary?.rowsFailed ? `; ${applyResult.summary.rowsFailed} failed.` : "."}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function AdminImportPage() {
  return (
    <OrgGuard>
      <AdminImportContent />
    </OrgGuard>
  );
}
