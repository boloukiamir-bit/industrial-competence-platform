"use client";

import { useEffect, useMemo, useState } from "react";

type RequirementsResponse = {
  line: string;
  skills: { id: string; code: string | null; name: string | null }[];
  stations: { id: string; name: string }[];
  requirements: { station_id: string; skill_id: string }[];
};

type StationRow = {
  id: string;
  name: string;
  safetyRequired: boolean;
};

type UpdatePayload = {
  station_id: string;
  required: boolean;
};

export default function StationSafetyRequirementsPanel({ selectedLine }: { selectedLine: string }) {
  const [stations, setStations] = useState<StationRow[]>([]);
  const [draft, setDraft] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [missingSkill, setMissingSkill] = useState(false);

  useEffect(() => {
    if (!selectedLine) {
      setStations([]);
      setDraft({});
      setError(null);
      setSuccess(null);
      setMissingSkill(false);
      return;
    }

    let canceled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const res = await fetch(`/api/requirements/by-line?line=${encodeURIComponent(selectedLine)}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Failed to load requirements");
        }
        const data = (await res.json()) as RequirementsResponse;
        const safetySkill = data.skills.find((skill) => skill.code === "SAFETY_INTRO");
        const requirementsForSafety = new Set(
          data.requirements
            .filter((req) => safetySkill && req.skill_id === safetySkill.id)
            .map((req) => req.station_id)
        );

        const rows = data.stations.map((station) => ({
          id: station.id,
          name: station.name,
          safetyRequired: safetySkill ? requirementsForSafety.has(station.id) : false,
        }));

        const nextDraft: Record<string, boolean> = {};
        for (const row of rows) {
          nextDraft[row.id] = row.safetyRequired;
        }

        if (!canceled) {
          setStations(rows);
          setDraft(nextDraft);
          setMissingSkill(!safetySkill);
        }
      } catch (err) {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "Failed to load requirements");
        }
      } finally {
        if (!canceled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      canceled = true;
    };
  }, [selectedLine]);

  const hasChanges = useMemo(
    () => stations.some((station) => draft[station.id] !== station.safetyRequired),
    [stations, draft]
  );

  async function handleSave() {
    if (!selectedLine || saving || loading || missingSkill || !hasChanges) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updates: UpdatePayload[] = stations
        .filter((station) => draft[station.id] !== station.safetyRequired)
        .map((station) => ({ station_id: station.id, required: !!draft[station.id] }));

      const res = await fetch("/api/requirements/by-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line: selectedLine, updates }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to save requirements");
      }

      setStations((prev) =>
        prev.map((station) => ({
          ...station,
          safetyRequired: !!draft[station.id],
        }))
      );
      setSuccess("Saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save requirements");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Station Safety Requirements
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Toggle whether SAFETY_INTRO is mandatory per station.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!selectedLine || !hasChanges || saving || loading || missingSkill}
          className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          data-testid="button-save-requirements"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {!selectedLine && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Select a line to edit station safety requirements.
        </p>
      )}

      {selectedLine && loading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">Loading requirements...</p>
      )}

      {selectedLine && error && (
        <p className="text-sm text-red-600 dark:text-red-400 mt-4">{error}</p>
      )}

      {selectedLine && success && !error && (
        <p className="text-sm text-green-600 dark:text-green-400 mt-4">{success}</p>
      )}

      {selectedLine && missingSkill && !loading && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-4">
          SAFETY_INTRO skill is missing. Add it in Skills before setting requirements.
        </p>
      )}

      {selectedLine && !loading && stations.length === 0 && !missingSkill && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          No active stations found for this line.
        </p>
      )}

      {selectedLine && stations.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left p-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  Station
                </th>
                <th className="text-left p-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                  Safety required
                </th>
              </tr>
            </thead>
            <tbody>
              {stations.map((station) => (
                <tr key={station.id} className="border-b border-gray-100 dark:border-gray-700/60">
                  <td className="p-2 text-gray-900 dark:text-white">{station.name}</td>
                  <td className="p-2">
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={!!draft[station.id]}
                        onChange={(event) =>
                          setDraft((prev) => ({ ...prev, [station.id]: event.target.checked }))
                        }
                        disabled={saving || loading || missingSkill}
                        data-testid={`toggle-safety-required-${station.id}`}
                      />
                      Safety required
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
