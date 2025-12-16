"use client";

import { useEffect, useState } from "react";
import { getPositionCoverageForDate, PositionCoverageSummary } from "@/services/competence";
import { Loader2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

function getTomorrowDateString(): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
}

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, string> = {
    HIGH: "hr-risk-pill hr-risk-pill--high",
    MEDIUM: "hr-risk-pill hr-risk-pill--medium",
    LOW: "hr-risk-pill hr-risk-pill--low",
  };

  return (
    <span className={variants[risk] || "hr-risk-pill"} data-testid={`risk-badge-${risk.toLowerCase()}`}>
      {risk}
    </span>
  );
}

function PositionCoverageCard({ position }: { position: PositionCoverageSummary }) {
  const coveragePercent = position.minHeadcount > 0 
    ? Math.round((position.availableCount / position.minHeadcount) * 100) 
    : 100;

  return (
    <div className="hr-card" data-testid={`card-position-${position.positionId}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <h3 className="hr-card__title">{position.positionName}</h3>
        <RiskBadge risk={position.riskLevel} />
      </div>
      
      <div className="hr-emp-summary-grid">
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Min Required</span>
          <span className="hr-emp-summary-value">{position.minHeadcount}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Fully Competent</span>
          <span className="hr-emp-summary-value">{position.availableCount}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Gap</span>
          <span className={`hr-emp-summary-value ${position.gap > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {position.gap}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm text-muted-foreground">Coverage</span>
          <span className="text-sm font-medium">{coveragePercent}%</span>
        </div>
        <Progress value={coveragePercent} className="h-2" />
      </div>

      {(position.site || position.department) && (
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          {position.site && <span>{position.site}</span>}
          {position.site && position.department && <span>/</span>}
          {position.department && <span>{position.department}</span>}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border">
        <Link 
          href="/competence/matrix" 
          className="text-sm text-primary hover:underline"
          data-testid={`link-matrix-${position.positionId}`}
        >
          View competence matrix
        </Link>
      </div>
    </div>
  );
}

export default function TomorrowsGapsPage() {
  const [positions, setPositions] = useState<PositionCoverageSummary[]>([]);
  const [effectiveDate, setEffectiveDate] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      const tomorrow = getTomorrowDateString();
      setEffectiveDate(tomorrow);
      
      try {
        const coverageData = await getPositionCoverageForDate(tomorrow);
        setPositions(coverageData);
      } catch (err) {
        console.error("Failed to load coverage data:", err);
        setError("Failed to load gap analysis data. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  const totalPositions = positions.length;
  const highRiskCount = positions.filter(p => p.riskLevel === "HIGH").length;
  const mediumRiskCount = positions.filter(p => p.riskLevel === "MEDIUM").length;
  const lowRiskCount = positions.filter(p => p.riskLevel === "LOW").length;
  const totalGap = positions.reduce((sum, p) => sum + p.gap, 0);

  if (loading) {
    return (
      <main className="hr-page">
        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
            <p className="hr-page__subtitle">
              Coverage and risk per position based on minimum headcount and competence.
            </p>
          </div>
        </header>
        <div className="flex items-center justify-center gap-3 p-12">
          <Loader2 className="h-5 w-5 animate-spin" data-testid="loading-spinner" />
          <span className="text-muted-foreground">Calculating tomorrow&apos;s gaps...</span>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="hr-page">
        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
            <p className="hr-page__subtitle">
              Coverage and risk per position based on minimum headcount and competence.
            </p>
          </div>
        </header>
        <div className="hr-error" data-testid="error-message">
          <AlertTriangle className="h-4 w-4 inline-block mr-2" />
          {error}
        </div>
      </main>
    );
  }

  if (positions.length === 0) {
    return (
      <main className="hr-page">
        <header className="hr-page__header">
          <div>
            <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
            <p className="hr-page__subtitle">
              Coverage and risk per position based on minimum headcount and competence.
            </p>
          </div>
          <div className="tg-date-pill" data-testid="date-pill">
            Analyzing: {effectiveDate}
          </div>
        </header>
        <div className="hr-empty" data-testid="empty-state">
          <p className="font-medium mb-2">No positions with minimum headcount defined</p>
          <p className="text-sm text-muted-foreground">
            Add min_headcount to positions to see Tomorrow&apos;s Gaps analysis.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="hr-page">
      <header className="hr-page__header">
        <div>
          <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
          <p className="hr-page__subtitle">
            Coverage and risk per position based on minimum headcount and competence.
          </p>
        </div>
        <div className="tg-date-pill" data-testid="date-pill">
          Analyzing: {effectiveDate}
        </div>
      </header>

      <div className="hr-kpi-grid" data-testid="summary-kpis">
        <div className="hr-kpi">
          <span className="hr-kpi__label">Total Positions</span>
          <span className="hr-kpi__value">{totalPositions}</span>
        </div>
        <div className="hr-kpi">
          <span className="hr-kpi__label">High Risk</span>
          <span className={`hr-kpi__value ${highRiskCount > 0 ? 'hr-kpi__value--danger' : ''}`}>
            {highRiskCount}
          </span>
        </div>
        <div className="hr-kpi">
          <span className="hr-kpi__label">Medium Risk</span>
          <span className={`hr-kpi__value ${mediumRiskCount > 0 ? 'hr-kpi__value--warn' : ''}`}>
            {mediumRiskCount}
          </span>
        </div>
        <div className="hr-kpi">
          <span className="hr-kpi__label">Low Risk</span>
          <span className="hr-kpi__value hr-kpi__value--ok">{lowRiskCount}</span>
        </div>
        <div className="hr-kpi">
          <span className="hr-kpi__label">Total Missing Headcount</span>
          <span className={`hr-kpi__value ${totalGap > 0 ? 'hr-kpi__value--danger' : ''}`}>
            {totalGap}
          </span>
        </div>
      </div>

      <div className="hr-grid mt-6" data-testid="positions-grid">
        {positions.map((position) => (
          <PositionCoverageCard key={position.positionId} position={position} />
        ))}
      </div>
    </main>
  );
}
