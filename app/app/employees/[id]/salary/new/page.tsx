"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrg } from "@/hooks/useOrg";

export default function NewSalaryRevisionPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const { currentOrg } = useOrg();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeName, setEmployeeName] = useState("");

  const [formData, setFormData] = useState({
    revisionDate: new Date().toISOString().split("T")[0],
    previousSalary: 0,
    newSalary: 0,
    salaryType: "monthly" as "monthly" | "hourly",
    reason: "",
  });

  useEffect(() => {
    async function load() {
      if (!currentOrg) {
        setEmployeeName("");
        setLoading(false);
        return;
      }
      const [employeeRes, salaryRes] = await Promise.all([
        supabase.from("employees").select("name").eq("org_id", currentOrg.id).eq("id", employeeId).single(),
        supabase
          .from("salary_records")
          .select("salary_amount_sek, salary_type")
          .eq("employee_id", employeeId)
          .order("effective_from", { ascending: false })
          .limit(1),
      ]);

      setEmployeeName(employeeRes.data?.name || "");

      if (salaryRes.data && salaryRes.data.length > 0) {
        setFormData((prev) => ({
          ...prev,
          previousSalary: parseFloat(salaryRes.data[0].salary_amount_sek),
          newSalary: parseFloat(salaryRes.data[0].salary_amount_sek),
          salaryType: salaryRes.data[0].salary_type || "monthly",
        }));
      }

      setLoading(false);
    }
    load();
  }, [employeeId, currentOrg]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await supabase.from("salary_revisions").insert({
        employee_id: employeeId,
        revision_date: formData.revisionDate,
        previous_salary_sek: formData.previousSalary,
        new_salary_sek: formData.newSalary,
        salary_type: formData.salaryType,
        reason: formData.reason || null,
      });

      await supabase.from("salary_records").insert({
        employee_id: employeeId,
        effective_from: formData.revisionDate,
        salary_amount_sek: formData.newSalary,
        salary_type: formData.salaryType,
      });

      router.push(`/app/employees/${employeeId}`);
    } catch (error) {
      console.error("Error creating salary revision:", error);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse h-64 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  const changePercent =
    formData.previousSalary > 0
      ? (((formData.newSalary - formData.previousSalary) / formData.previousSalary) * 100).toFixed(1)
      : 0;

  return (
    <div className="p-6 max-w-xl">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            New Salary Revision
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For {employeeName}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Revision Date *
            </label>
            <input
              type="date"
              value={formData.revisionDate}
              onChange={(e) => setFormData({ ...formData, revisionDate: e.target.value })}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="input-revision-date"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Salary Type
            </label>
            <select
              value={formData.salaryType}
              onChange={(e) =>
                setFormData({ ...formData, salaryType: e.target.value as "monthly" | "hourly" })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="select-salary-type"
            >
              <option value="monthly">Monthly</option>
              <option value="hourly">Hourly</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Previous Salary (SEK)
              </label>
              <input
                type="number"
                value={formData.previousSalary}
                onChange={(e) =>
                  setFormData({ ...formData, previousSalary: parseFloat(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                data-testid="input-previous-salary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                New Salary (SEK) *
              </label>
              <input
                type="number"
                value={formData.newSalary}
                onChange={(e) =>
                  setFormData({ ...formData, newSalary: parseFloat(e.target.value) || 0 })
                }
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="input-new-salary"
              />
            </div>
          </div>

          {formData.previousSalary > 0 && formData.newSalary !== formData.previousSalary && (
            <div
              className={`p-3 rounded-md ${
                formData.newSalary > formData.previousSalary
                  ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
              }`}
            >
              Change: {formData.newSalary > formData.previousSalary ? "+" : ""}
              {(formData.newSalary - formData.previousSalary).toLocaleString("sv-SE")} SEK (
              {formData.newSalary > formData.previousSalary ? "+" : ""}
              {changePercent}%)
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder="Annual salary review, promotion, etc."
              data-testid="textarea-reason"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            data-testid="button-cancel"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
            data-testid="button-save-revision"
          >
            {saving ? "Saving..." : "Save Revision"}
          </button>
        </div>
      </form>
    </div>
  );
}
