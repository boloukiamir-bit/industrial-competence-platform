"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { withDevBearer } from "@/lib/devBearer";

type CompetencyScore = {
  ok: boolean;
  overallScore?: number;
  grade?: string;
  safetyPct?: number;
  technicalPct?: number;
  compliancePct?: number;
};

export function TeamCompetencyScoreCard() {
  const [data, setData] = useState<CompetencyScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/dashboard/competency-score", {
          credentials: "include",
          headers: withDevBearer(),
        });
        const json = (await res.json()) as CompetencyScore;
        if (!cancelled && json.ok) setData(json);
        else if (!cancelled) setData(null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card className="overflow-hidden" data-testid="card-competency-score">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="h-3 w-32 bg-muted rounded" />
                <div className="h-8 w-20 bg-muted rounded" />
              </div>
              <div className="h-16 w-16 rounded-full bg-muted" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-3 w-24 bg-muted rounded" />
                  <div className="h-2 bg-muted rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.ok) return null;

  const overallScore = data.overallScore ?? 0;
  const gradeLabel = data.grade ?? "—";
  const safetyPct = data.safetyPct ?? 0;
  const technicalPct = data.technicalPct ?? 0;
  const compliancePct = data.compliancePct ?? 0;

  return (
    <Card className="overflow-hidden" data-testid="card-competency-score">
      <div className="bg-muted/50 px-4 py-3 border-b border-border flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-destructive/60" />
          <div className="w-3 h-3 rounded-full bg-chart-4/60" />
          <div className="w-3 h-3 rounded-full bg-chart-3/60" />
        </div>
        <span className="text-xs text-muted-foreground ml-2">Dashboard Preview</span>
      </div>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Team Competency Score</p>
            <p className="text-2xl font-bold">{overallScore}%</p>
          </div>
          <div className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center bg-primary/5">
            <span className="text-sm font-semibold text-primary">{gradeLabel}</span>
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Safety Certifications</span>
              <span className="font-medium">{safetyPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-chart-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, safetyPct)}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Technical Skills</span>
              <span className="font-medium">{technicalPct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, technicalPct)}%` }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Compliance Training</span>
              <span className="font-medium">{compliancePct}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-chart-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(100, compliancePct)}%` }}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
