"use client";

import { useEffect, useState } from "react";
import { WhatToFixSummary } from "@/components/WhatToFixSummary";
import { 
  calculateTomorrowsGaps, 
  getCriticalGapsFromItems, 
  getTrainingPriorities, 
  getOverstaffedSkills,
  getSkillStats,
  getTomorrowsGaps,
  type PositionGapSummary,
  type TomorrowsGapsOverview
} from "@/services/gaps";
import type { GapItem } from "@/types/domain";
import { Loader2, AlertTriangle, Users, TrendingDown, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

function RiskBadge({ risk }: { risk: string }) {
  const variants: Record<string, string> = {
    CRITICAL: "hr-risk-pill hr-risk-pill--critical",
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

function PositionGapCard({ position }: { position: PositionGapSummary }) {
  return (
    <div className="hr-card" data-testid={`card-position-gap-${position.positionId}`}>
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
          <span className="hr-emp-summary-label">Total Staff</span>
          <span className="hr-emp-summary-value">{position.totalEmployees}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Fully Qualified</span>
          <span className="hr-emp-summary-value">{position.fullyCompetentCount}</span>
        </div>
        <div className="hr-emp-summary-card">
          <span className="hr-emp-summary-label">Gap</span>
          <span className={`hr-emp-summary-value ${position.gapCount > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
            {position.gapCount}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-muted-foreground">Coverage</span>
          <span className="text-sm font-medium">{position.coveragePercent}%</span>
        </div>
        <Progress value={position.coveragePercent} className="h-2" />
      </div>

      {position.riskReason && (
        <p className="text-sm text-muted-foreground mt-3">{position.riskReason}</p>
      )}

      {position.site && (
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <span>{position.site}</span>
          {position.department && (
            <>
              <span>/</span>
              <span>{position.department}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TomorrowsGapsPage() {
  const [gaps, setGaps] = useState<GapItem[]>([]);
  const [criticalGaps, setCriticalGaps] = useState<{ line: string; role: string; skill: string; missingCount: number }[]>([]);
  const [trainingPriorities, setTrainingPriorities] = useState<{ skill: string; countLevel0or1: number }[]>([]);
  const [overstaffedSkills, setOverstaffedSkills] = useState<{ skill: string; countLevel3or4: number }[]>([]);
  const [positionGaps, setPositionGaps] = useState<TomorrowsGapsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [legacyGapsUnavailable, setLegacyGapsUnavailable] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        const positionGapsData = await getTomorrowsGaps();
        setPositionGaps(positionGapsData);
        
        try {
          const gapsData = await calculateTomorrowsGaps();
          setGaps(gapsData);
          setCriticalGaps(getCriticalGapsFromItems(gapsData));
          
          const skillStats = await getSkillStats();
          setTrainingPriorities(getTrainingPriorities(skillStats));
          setOverstaffedSkills(getOverstaffedSkills(skillStats));
        } catch (legacyErr) {
          console.warn("Legacy skill gaps not available:", legacyErr);
          setLegacyGapsUnavailable(true);
        }
      } catch (err) {
        console.error("Failed to load gaps data:", err);
        setError("Failed to load gap analysis data");
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="hr-page">
        <div className="hr-page__header">
          <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
        </div>
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin" data-testid="loading-spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hr-page">
        <div className="hr-page__header">
          <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
        </div>
        <div className="hr-error" data-testid="error-message">{error}</div>
      </div>
    );
  }

  const summary = positionGaps?.summary;

  return (
    <div className="hr-page">
      <div className="hr-page__header">
        <h1 className="hr-page__title">Tomorrow&apos;s Gaps</h1>
        <p className="hr-page__subtitle">
          Risk and coverage analysis per position based on minimum headcount requirements
        </p>
      </div>

      {summary && (
        <div className="hr-kpi-grid" data-testid="summary-kpis">
          <div className="hr-kpi">
            <span className="hr-kpi__label">Total Positions</span>
            <span className="hr-kpi__value">{summary.totalPositions}</span>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi__label">Critical Risk</span>
            <span className={`hr-kpi__value ${summary.criticalPositions > 0 ? 'hr-kpi__value--danger' : ''}`}>
              {summary.criticalPositions}
            </span>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi__label">High Risk</span>
            <span className={`hr-kpi__value ${summary.highRiskPositions > 0 ? 'hr-kpi__value--danger' : ''}`}>
              {summary.highRiskPositions}
            </span>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi__label">Medium Risk</span>
            <span className={`hr-kpi__value ${summary.mediumRiskPositions > 0 ? 'hr-kpi__value--warn' : ''}`}>
              {summary.mediumRiskPositions}
            </span>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi__label">Low Risk</span>
            <span className="hr-kpi__value hr-kpi__value--ok">{summary.lowRiskPositions}</span>
          </div>
          <div className="hr-kpi">
            <span className="hr-kpi__label">Total Gap Headcount</span>
            <span className={`hr-kpi__value ${summary.totalGapHeadcount > 0 ? 'hr-kpi__value--danger' : ''}`}>
              {summary.totalGapHeadcount}
            </span>
          </div>
        </div>
      )}

      {positionGaps?.configWarning && (
        <div className="flex items-start gap-3 p-4 mt-4 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950" data-testid="config-warning">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Configuration Needed</p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              {positionGaps.configWarning}
            </p>
          </div>
        </div>
      )}

      <Tabs defaultValue="positions" className="mt-6">
        <TabsList>
          <TabsTrigger value="positions" data-testid="tab-positions">
            Position Coverage
          </TabsTrigger>
          <TabsTrigger value="skills" data-testid="tab-skills">
            Skill Gaps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          {positionGaps && positionGaps.positions.length > 0 ? (
            <div className="hr-grid" data-testid="position-gaps-grid">
              {positionGaps.positions.map((position) => (
                <PositionGapCard key={position.positionId} position={position} />
              ))}
            </div>
          ) : (
            <div className="hr-empty" data-testid="no-positions-message">
              No positions found. Add positions and set minimum headcount to see gap analysis.
            </div>
          )}
        </TabsContent>

        <TabsContent value="skills" className="mt-4">
          {legacyGapsUnavailable ? (
            <div className="hr-empty" data-testid="legacy-gaps-unavailable">
              <p className="font-medium mb-2">Skill Gap Analysis Unavailable</p>
              <p className="text-sm text-muted-foreground">
                The legacy skill gap analysis requires role_skill_requirements and skills tables to be configured.
                Use the Position Coverage tab to see gap analysis based on position competence requirements.
              </p>
            </div>
          ) : (
            <>
              <WhatToFixSummary
                criticalGaps={criticalGaps}
                trainingPriorities={trainingPriorities}
                overstaffedSkills={overstaffedSkills}
              />

              <div className="mt-8">
                <h2 className="hr-section__title">Detailed Skill Gaps</h2>
                
                {gaps.length === 0 ? (
                  <div className="hr-empty" data-testid="no-skill-gaps-message">
                    No skill gaps detected. All skill requirements are met.
                  </div>
                ) : (
                  <div className="hr-grid">
                    {gaps.map((gap, index) => (
                      <Card key={index} data-testid={`card-gap-${index}`}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <CardTitle className="text-base">{gap.skillName}</CardTitle>
                            <Badge variant="destructive">
                              Missing: {gap.missingCount}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Line:</span>
                              <p className="font-medium">{gap.line}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Role:</span>
                              <p className="font-medium">{gap.role}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Required Level:</span>
                              <p className="font-medium">{gap.requiredLevel}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Current Avg:</span>
                              <p className="font-medium">{gap.currentAvgLevel}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
