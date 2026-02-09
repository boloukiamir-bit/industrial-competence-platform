"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";

type ProfileItem = {
  competenceId: string;
  competenceName: string;
  competenceCode: string | null;
  groupName: string | null;
  requiredLevel: number | null;
  mandatory: boolean;
  employeeLevel: number | null;
  validTo: string | null;
  status: "OK" | "GAP" | "RISK" | "N/A";
  riskReason: string | null;
  isSafetyCritical: boolean;
};

type Profile = {
  employee: {
    id: string;
    name: string;
    positionName: string | null;
    positionId: string | null;
  };
  summary: {
    riskLevel: string;
    gapCount: number;
    totalRequired: number;
    coveragePercent: number;
    expiredCount: number;
  };
  items: ProfileItem[];
  positions: { id: string; name: string }[];
};

export default function EmployeeCompetencePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const { loading: authLoading } = useAuthGuard();

  if (authLoading) {
    return (
      <main className="hr-page">
        <p>Checking access...</p>
      </main>
    );
  }

  return <EmployeeCompetenceContent params={resolvedParams} />;
}

function EmployeeCompetenceContent({ params }: { params: { id: string } }) {
  const employeeId = params.id;
  const router = useRouter();
  const { isAdminOrHr } = useOrg();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assigningPosition, setAssigningPosition] = useState(false);
  const [selectedPositionId, setSelectedPositionId] = useState<string>("");

  const canWrite = isAdminOrHr;
  const { toast } = useToast();

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/employees/${employeeId}/competence`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to load");
      }
      const data = (await res.json()) as Profile;
      setProfile(data);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Could not load competence profile.");
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpsert = useCallback(async (
    competenceId: string,
    level: number,
    validTo: string | null
  ) => {
    if (!canWrite) return;
    setSavingId(competenceId);
    try {
      const res = await fetch(`/api/employees/${employeeId}/competence/upsert`, {
        method: "POST",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          skill_id: competenceId,
          level,
          valid_to: validTo || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to save");
      }
      toast({ title: "Saved." });
      await loadProfile();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed.", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }, [canWrite, employeeId, loadProfile, toast]);

  const handleAssignPosition = useCallback(async (positionId: string | null) => {
    if (!canWrite) return;
    setAssigningPosition(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ position_id: positionId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to assign position");
      }
      toast({ title: "Position assigned." });
      await loadProfile();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Assign failed.", variant: "destructive" });
    } finally {
      setAssigningPosition(false);
    }
  }, [canWrite, employeeId, loadProfile, toast]);

  return (
    <main className="hr-page">
      <button className="hr-link" onClick={() => router.back()} type="button">
        ← Back
      </button>

      {loading && <p>Loading competence profile…</p>}
      {error && <p className="hr-error">{error}</p>}

      {!loading && !error && profile && (
        <>
          <header className="hr-emp-header">
            <div>
              <h1 className="hr-page__title">{profile.employee.name}</h1>
              <p className="hr-page__subtitle">
                {profile.employee.positionName ?? "No position assigned yet"}
              </p>
            </div>
            <div className="hr-emp-header__badge">
              <span
                className={`hr-risk-pill hr-risk-pill--${profile.summary.riskLevel.toLowerCase()}`}
              >
                Risk: {profile.summary.riskLevel}
              </span>
            </div>
          </header>

          {!profile.employee.positionId && canWrite && profile.positions.length > 0 && (
            <section className="hr-competence-section" style={{ marginBottom: 24 }}>
              <h2 className="hr-section__title">Assign position</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="hr-select"
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  disabled={assigningPosition}
                  data-testid="select-assign-position"
                >
                  <option value="">Select position…</option>
                  {profile.positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="hr-button hr-button--primary"
                  disabled={!selectedPositionId || assigningPosition}
                  onClick={() => handleAssignPosition(selectedPositionId)}
                  data-testid="button-assign-position"
                >
                  {assigningPosition ? "Assigning…" : "Assign"}
                </button>
              </div>
            </section>
          )}

          <section className="hr-emp-summary-grid">
            <SummaryCard label="Required" value={profile.summary.totalRequired} />
            <SummaryCard label="Gaps" value={profile.summary.gapCount} />
            <SummaryCard label="Coverage" value={`${profile.summary.coveragePercent}%`} />
            <SummaryCard label="Expired" value={profile.summary.expiredCount} />
          </section>

          <section className="hr-competence-section">
            <h2 className="hr-section__title">Competences</h2>
            <p className="hr-task-section__description">
              Requirements based on position and actual ratings per competence.
            </p>

            <div className="hr-competence-table-wrapper">
              <table className="hr-competence-table">
                <thead>
                  <tr>
                    <th>Group</th>
                    <th>Competence</th>
                    <th>Required</th>
                    <th>Level</th>
                    <th>Valid to</th>
                    <th>Status</th>
                    <th>{canWrite ? "Save" : ""}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.items.map((item) => (
                    <CompetenceRow
                      key={item.competenceId}
                      item={item}
                      canWrite={canWrite}
                      saving={savingId === item.competenceId}
                      onSave={handleUpsert}
                      onTriggerAction={(msg) => toast({ title: msg, variant: "destructive" })}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="hr-emp-summary-card">
      <div className="hr-emp-summary-label">{label}</div>
      <div className="hr-emp-summary-value">{value}</div>
    </div>
  );
}

function CompetenceRow({
  item,
  canWrite,
  saving,
  onSave,
  onTriggerAction,
}: {
  item: ProfileItem;
  canWrite: boolean;
  saving: boolean;
  onSave: (competenceId: string, level: number, validTo: string | null) => void;
  onTriggerAction: (msg: string) => void;
}) {
  const [level, setLevel] = useState<number>(item.employeeLevel ?? 0);
  const [validTo, setValidTo] = useState<string>(item.validTo ?? "");

  useEffect(() => {
    setLevel(item.employeeLevel ?? 0);
    setValidTo(item.validTo ?? "");
  }, [item.employeeLevel, item.validTo]);

  const levelLabel = (lvl: number | null | undefined) => {
    if (lvl == null) return "-";
    return lvl.toString();
  };

  const statusClass =
    item.status === "OK"
      ? "hr-status-badge--ok"
      : item.status === "RISK"
        ? "hr-status-badge--risk"
        : "hr-status-badge--na";

  const dueLabel = item.validTo ? new Date(item.validTo).toLocaleDateString() : "-";
  const showAction = item.status === "RISK";

  const handleSave = () => {
    onSave(item.competenceId, level, validTo.trim() || null);
  };

  const handleClick = () => {
    onTriggerAction(
      `Action needed for competence "${item.competenceName}". (Link to training workflow when template is set.)`
    );
  };

  return (
    <tr data-testid={`row-competence-${item.competenceId}`}>
      <td>{item.groupName ?? "-"}</td>
      <td>
        <div className="hr-competence-name">
          {item.competenceName}
          {item.isSafetyCritical && (
            <span className="hr-competence-chip">Safety</span>
          )}
        </div>
      </td>
      <td>
        <span className="hr-level-chip">{levelLabel(item.requiredLevel)}</span>
      </td>
      <td>
        {canWrite ? (
          <select
            className="hr-select hr-select--sm"
            value={level}
            onChange={(e) => setLevel(parseInt(e.target.value, 10))}
            data-testid={`select-level-${item.competenceId}`}
          >
            {[0, 1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : (
          <span className="hr-level-chip hr-level-chip--owned">
            {levelLabel(item.employeeLevel)}
          </span>
        )}
      </td>
      <td>
        {canWrite ? (
          <input
            type="date"
            className="hr-input hr-input--sm"
            value={validTo}
            onChange={(e) => setValidTo(e.target.value)}
            data-testid={`input-valid-to-${item.competenceId}`}
          />
        ) : (
          dueLabel
        )}
      </td>
      <td>
        <span className={`hr-status-badge ${statusClass}`}>{item.status}</span>
        {item.riskReason && (
          <div className="hr-status-reason">{item.riskReason}</div>
        )}
      </td>
      <td>
        {canWrite ? (
          <button
            type="button"
            className="hr-button hr-button--primary hr-button--dense hr-button--sm"
            onClick={handleSave}
            disabled={saving}
            data-testid={`button-save-${item.competenceId}`}
          >
            {saving ? "…" : "Save"}
          </button>
        ) : showAction ? (
          <button
            type="button"
            className="hr-button hr-button--secondary hr-button--dense"
            onClick={handleClick}
          >
            Action
          </button>
        ) : null}
      </td>
    </tr>
  );
}
