"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { COPY } from "@/lib/copy";
import { isDemoMode, DEMO_EMPLOYEES, DEMO_SKILLS, DEMO_POSITIONS, DEMO_ORG_UNITS } from "@/lib/demoData";
import { cn } from "@/lib/utils";

const SETUP_STORAGE_KEY = "nadiplan_setup_progress";

interface SetupProgressCardProps {
  className?: string;
  /** When true, render nothing when setup is 100% complete (e.g. for Cockpit digest). */
  hideWhenComplete?: boolean;
}

export function SetupProgressCard({ className, hideWhenComplete = false }: SetupProgressCardProps) {
  const router = useRouter();
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem(SETUP_STORAGE_KEY);
      const storedProgress = stored ? JSON.parse(stored) : {};

      if (isDemoMode()) {
        setProgress({
          orgUnit: DEMO_ORG_UNITS.length >= 1,
          employees: DEMO_EMPLOYEES.length >= 1,
          skills: DEMO_SKILLS.length >= 3,
          positions: DEMO_POSITIONS.length >= 1,
          gaps: storedProgress.gaps ?? false,
        });
      } else {
        setProgress(storedProgress);
      }
    } catch {
      setProgress({});
    }
    setLoading(false);
  }, []);

  const steps = ["orgUnit", "employees", "skills", "positions", "gaps"];
  const completedCount = steps.filter((s) => progress[s]).length;
  const allComplete = completedCount === steps.length;
  const progressPercent = steps.length > 0 ? (completedCount / steps.length) * 100 : 0;

  if (loading) {
    return (
      <Card className={cn("rounded-[20px] border", className)}>
        <CardContent className="py-6">
          <div className="animate-pulse h-16 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (allComplete && hideWhenComplete) {
    return null;
  }

  if (allComplete) {
    return (
      <Card className={cn("rounded-[20px] border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20", className)}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 shrink-0" />
            <span className="font-medium text-green-700 dark:text-green-300" data-testid="text-setup-complete">
              {COPY.setup.complete}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn("rounded-[20px] border bg-card transition-all hover:shadow-md", className)}
      data-testid="card-setup-progress"
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xl font-semibold tracking-tight" style={{ letterSpacing: "-0.03em" }}>
            {COPY.setup.title}
          </CardTitle>
          <Badge variant="secondary" className="tabular-nums">
            {completedCount} / {steps.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="mb-4 h-2" />
        <p className="text-sm text-muted-foreground mb-4">
          {COPY.setup.description}
        </p>
        <button
          type="button"
          onClick={() => router.push("/app/setup")}
          className="hr-button hr-button--primary inline-flex items-center gap-1"
          data-testid="button-go-to-setup"
        >
          Continue Setup
          <ArrowRight className="h-4 w-4 ml-1" />
        </button>
      </CardContent>
    </Card>
  );
}
