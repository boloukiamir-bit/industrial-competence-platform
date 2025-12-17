"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { COPY } from "@/lib/copy";
import { isDemoMode, DEMO_EMPLOYEES, DEMO_SKILLS, DEMO_POSITIONS, DEMO_ORG_UNITS } from "@/lib/demoData";

const SETUP_STORAGE_KEY = "nadiplan_setup_progress";

interface SetupProgressCardProps {
  className?: string;
}

export function SetupProgressCard({ className }: SetupProgressCardProps) {
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
  const progressPercent = (completedCount / steps.length) * 100;

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="py-6">
          <div className="animate-pulse h-16 bg-gray-200 dark:bg-gray-700 rounded" />
        </CardContent>
      </Card>
    );
  }

  if (allComplete) {
    return (
      <Card className={`border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 ${className}`}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            <span className="font-medium text-green-700 dark:text-green-300" data-testid="text-setup-complete">
              {COPY.setup.complete}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="card-setup-progress">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-lg">{COPY.setup.title}</CardTitle>
          <Badge variant="secondary">
            {completedCount} / {steps.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress value={progressPercent} className="mb-4" />
        <p className="text-sm text-muted-foreground mb-4">
          {COPY.setup.description}
        </p>
        <Button onClick={() => router.push("/app/setup")} data-testid="button-go-to-setup">
          Continue Setup
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
