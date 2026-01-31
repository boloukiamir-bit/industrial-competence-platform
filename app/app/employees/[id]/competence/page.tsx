// app/employees/[id]/competence/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getEmployeeCompetenceProfile,
  EmployeeCompetenceProfile,
  EmployeeCompetenceItem,
} from "@/services/competence";
import { useAuthGuard } from "@/hooks/useAuthGuard";

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

function EmployeeCompetenceContent({
  params,
}: {
  params: { id: string };
}) {
  const employeeId = params.id;
  const router = useRouter();

  const [profile, setProfile] = useState<EmployeeCompetenceProfile | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getEmployeeCompetenceProfile(employeeId);
        setProfile(data);
      } catch (err) {
        console.error(err);
        setError("Kunde inte ladda kompetensprofil.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [employeeId]);

  return (
    <main className="hr-page">
      <button className="hr-link" onClick={() => router.back()}>
        ← Tillbaka
      </button>

      {loading && <p>Laddar kompetensprofil…</p>}
      {error && <p className="hr-error">{error}</p>}

      {!loading && !error && profile && (
        <>
          <header className="hr-emp-header">
            <div>
              <h1 className="hr-page__title">{profile.employee.name}</h1>
              <p className="hr-page__subtitle">
                {profile.employee.positionName
                  ? profile.employee.positionName
                  : "Ingen position kopplad ännu"}
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

          <section className="hr-emp-summary-grid">
            <SummaryCard
              label="Obligatoriska kompetenser"
              value={profile.summary.totalRequired}
            />
            <SummaryCard
              label="Kompetens-gaps"
              value={profile.summary.gapCount}
            />
            <SummaryCard
              label="Täckningsgrad"
              value={`${profile.summary.coveragePercent}%`}
            />
            <SummaryCard
              label="Utgångna kompetenser"
              value={profile.summary.expiredCount}
            />
          </section>

          {actionMessage && (
            <p className="hr-action-message">{actionMessage}</p>
          )}

          <section className="hr-competence-section">
            <h2 className="hr-section__title">Kompetenser</h2>
            <p className="hr-task-section__description">
              Krav baserat på roll samt faktiska kompetenser per person.
            </p>

            <div className="hr-competence-table-wrapper">
              <table className="hr-competence-table">
                <thead>
                  <tr>
                    <th>Grupp</th>
                    <th>Kompetens</th>
                    <th>Krav (nivå)</th>
                    <th>Har (nivå)</th>
                    <th>Giltig t.o.m.</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {profile.items.map((item) => (
                    <CompetenceRow
                      key={item.competenceId}
                      item={item}
                      onTriggerAction={(msg) => setActionMessage(msg)}
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
  onTriggerAction,
}: {
  item: EmployeeCompetenceItem;
  onTriggerAction: (msg: string) => void;
}) {
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

  const dueLabel = item.validTo
    ? new Date(item.validTo).toLocaleDateString()
    : "-";

  const showAction = item.status === "RISK";

  // Här kan vi senare koppla "Starta utbildning"-workflow.
  function handleClick() {
    onTriggerAction(
      `Åtgärd behövs för kompetens "${item.competenceName}". (Koppla till utbildnings-workflow när template är satt.)`,
    );
  }

  return (
    <tr>
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
        <span className="hr-level-chip hr-level-chip--owned">
          {levelLabel(item.employeeLevel)}
        </span>
      </td>
      <td>{dueLabel}</td>
      <td>
        <span className={`hr-status-badge ${statusClass}`}>{item.status}</span>
        {item.riskReason && (
          <div className="hr-status-reason">{item.riskReason}</div>
        )}
      </td>
      <td>
        {showAction && (
          <button
            type="button"
            className="hr-button hr-button--secondary hr-button--dense"
            onClick={handleClick}
          >
            Åtgärda
          </button>
        )}
      </td>
    </tr>
  );
}
