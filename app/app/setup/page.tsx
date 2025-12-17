"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  Circle, 
  Building2, 
  Users, 
  BookOpen, 
  Briefcase, 
  TrendingUp,
  ArrowRight 
} from "lucide-react";
import { COPY } from "@/lib/copy";
import { isDemoMode, DEMO_EMPLOYEES, DEMO_SKILLS, DEMO_POSITIONS, DEMO_ORG_UNITS } from "@/lib/demoData";

interface SetupStep {
  id: string;
  title: string;
  completed: boolean;
  icon: typeof Building2;
  action: () => void;
  buttonLabel: string;
  secondaryAction?: () => void;
  secondaryButtonLabel?: string;
}

const SETUP_STORAGE_KEY = "nadiplan_setup_progress";

function getStoredProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(SETUP_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveProgress(progress: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETUP_STORAGE_KEY, JSON.stringify(progress));
}

export default function SetupPage() {
  const router = useRouter();
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = getStoredProgress();
    
    if (isDemoMode()) {
      setProgress({
        orgUnit: DEMO_ORG_UNITS.length >= 1,
        employees: DEMO_EMPLOYEES.length >= 1,
        skills: DEMO_SKILLS.length >= 3,
        positions: DEMO_POSITIONS.length >= 1,
        gaps: false,
      });
    } else {
      setProgress(stored);
    }
    setLoading(false);
  }, []);

  const markComplete = (stepId: string) => {
    const newProgress = { ...progress, [stepId]: true };
    setProgress(newProgress);
    saveProgress(newProgress);
  };

  const steps: SetupStep[] = [
    {
      id: "orgUnit",
      title: COPY.setup.steps.orgUnit.title,
      completed: progress.orgUnit ?? false,
      icon: Building2,
      action: () => router.push("/app/org/overview"),
      buttonLabel: COPY.setup.steps.orgUnit.button,
    },
    {
      id: "employees",
      title: COPY.setup.steps.employees.title,
      completed: progress.employees ?? false,
      icon: Users,
      action: () => router.push("/app/import-employees"),
      buttonLabel: COPY.setup.steps.employees.buttonPrimary,
      secondaryAction: () => router.push("/app/employees"),
      secondaryButtonLabel: COPY.setup.steps.employees.buttonSecondary,
    },
    {
      id: "skills",
      title: COPY.setup.steps.skills.title,
      completed: progress.skills ?? false,
      icon: BookOpen,
      action: () => router.push("/admin/competence"),
      buttonLabel: COPY.setup.steps.skills.button,
    },
    {
      id: "positions",
      title: COPY.setup.steps.positions.title,
      completed: progress.positions ?? false,
      icon: Briefcase,
      action: () => router.push("/admin/positions"),
      buttonLabel: COPY.setup.steps.positions.button,
    },
    {
      id: "gaps",
      title: COPY.setup.steps.gaps.title,
      completed: progress.gaps ?? false,
      icon: TrendingUp,
      action: () => {
        markComplete("gaps");
        router.push("/app/gaps");
      },
      buttonLabel: COPY.setup.steps.gaps.button,
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const allComplete = completedCount === steps.length;

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto" data-testid="setup-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="heading-setup">
          {COPY.setup.title}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {COPY.setup.description}
        </p>
      </div>

      {allComplete && (
        <Card className="mb-6 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              <span className="font-medium text-green-700 dark:text-green-300" data-testid="text-setup-complete">
                {COPY.setup.complete}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle>Setup Checklist</CardTitle>
            <Badge variant={allComplete ? "default" : "secondary"}>
              {completedCount} / {steps.length} completed
            </Badge>
          </div>
          <CardDescription>
            Complete each step to unlock the full potential of your platform.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 p-4 rounded-md border ${
                step.completed
                  ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                  : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
              }`}
              data-testid={`setup-step-${step.id}`}
            >
              <div className="flex-shrink-0">
                {step.completed ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <Circle className="h-6 w-6 text-gray-300 dark:text-gray-600" />
                )}
              </div>
              <step.icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <div className="flex-1">
                <span
                  className={`font-medium ${
                    step.completed
                      ? "text-green-700 dark:text-green-300"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {step.title}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {step.secondaryAction && !step.completed && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={step.secondaryAction}
                    data-testid={`button-${step.id}-secondary`}
                  >
                    {step.secondaryButtonLabel}
                  </Button>
                )}
                {!step.completed && (
                  <Button
                    size="sm"
                    onClick={step.action}
                    data-testid={`button-${step.id}`}
                  >
                    {step.buttonLabel}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 flex justify-center">
        <Button variant="outline" onClick={() => router.push("/app/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  );
}
