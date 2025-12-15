"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { ReviewTemplate, ReviewGoal } from "@/types/domain";

export default function NewReviewPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;

  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employeeName, setEmployeeName] = useState("");

  const [formData, setFormData] = useState({
    templateId: "",
    reviewDate: new Date().toISOString().split("T")[0],
    periodStart: "",
    periodEnd: "",
    overallRating: 0,
    summary: "",
    notes: "",
  });
  const [goals, setGoals] = useState<ReviewGoal[]>([]);

  useEffect(() => {
    async function load() {
      const [templatesRes, employeeRes] = await Promise.all([
        supabase.from("review_templates").select("*").eq("is_active", true).order("name"),
        supabase.from("employees").select("name").eq("id", employeeId).single(),
      ]);

      setTemplates(
        (templatesRes.data || []).map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          audience: t.audience,
          isActive: t.is_active,
          createdAt: t.created_at,
        }))
      );
      setEmployeeName(employeeRes.data?.name || "");
      setLoading(false);
    }
    load();
  }, [employeeId]);

  function addGoal() {
    setGoals([
      ...goals,
      { id: crypto.randomUUID(), text: "", status: "pending" },
    ]);
  }

  function updateGoal(id: string, text: string) {
    setGoals(goals.map((g) => (g.id === id ? { ...g, text } : g)));
  }

  function removeGoal(id: string) {
    setGoals(goals.filter((g) => g.id !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await supabase.from("employee_reviews").insert({
        employee_id: employeeId,
        template_id: formData.templateId || null,
        review_date: formData.reviewDate,
        period_start: formData.periodStart || null,
        period_end: formData.periodEnd || null,
        overall_rating: formData.overallRating || null,
        summary: formData.summary || null,
        goals: goals.filter((g) => g.text.trim()).length > 0 ? goals.filter((g) => g.text.trim()) : null,
        notes: formData.notes || null,
      });
      router.push(`/app/employees/${employeeId}`);
    } catch (error) {
      console.error("Error creating review:", error);
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

  return (
    <div className="p-6 max-w-2xl">
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
            New Review
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
              Template
            </label>
            <select
              value={formData.templateId}
              onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              data-testid="select-template"
            >
              <option value="">Select template...</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Review Date *
              </label>
              <input
                type="date"
                value={formData.reviewDate}
                onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="input-review-date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period Start
              </label>
              <input
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="input-period-start"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Period End
              </label>
              <input
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                data-testid="input-period-end"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Overall Rating (1-5)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => setFormData({ ...formData, overallRating: rating })}
                  className={`w-10 h-10 rounded-md font-medium transition-colors ${
                    formData.overallRating === rating
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                  data-testid={`button-rating-${rating}`}
                >
                  {rating}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Summary
            </label>
            <textarea
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder="Overall feedback and observations..."
              data-testid="textarea-summary"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Goals
              </label>
              <button
                type="button"
                onClick={addGoal}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                data-testid="button-add-goal"
              >
                <Plus className="h-4 w-4" />
                Add Goal
              </button>
            </div>
            {goals.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No goals added</p>
            ) : (
              <div className="space-y-2">
                {goals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={goal.text}
                      onChange={(e) => updateGoal(goal.id, e.target.value)}
                      placeholder="Goal description..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      data-testid={`input-goal-${goal.id}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeGoal(goal.id)}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                      data-testid={`button-remove-goal-${goal.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
              placeholder="Additional notes..."
              data-testid="textarea-notes"
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
            data-testid="button-save-review"
          >
            {saving ? "Saving..." : "Save Review"}
          </button>
        </div>
      </form>
    </div>
  );
}
