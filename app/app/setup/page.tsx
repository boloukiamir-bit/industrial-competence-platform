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
import { supabase } from "@/lib/supabaseClient";
import { useOrg } from "@/hooks/useOrg";

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

export default function SetupPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [progress, setProgress] = useState<Record<string, boolean>>({
    orgUnit: false,
    employees: false,
    skills: false,
    positions: false,
    gaps: false,
  });
  const [loading, setLoading] = useState(true);
  const [hasActiveOrg, setHasActiveOrg] = useState(false);

  useEffect(() => {
    async function checkSetupProgress() {
      // Check 1: Organization exists & active_org_id present
      let hasOrg = false;
      let activeOrgId: string | null = null;

      if (currentOrg) {
        hasOrg = true;
        activeOrgId = currentOrg.id;
      } else {
        // Also check profile for active_org_id
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("active_org_id")
            .eq("id", user.id)
            .single();
          
          if (profile?.active_org_id) {
            hasOrg = true;
            activeOrgId = profile.active_org_id;
          }
        }
      }

      if (!hasOrg || !activeOrgId) {
        setHasActiveOrg(false);
        setProgress({
          orgUnit: false,
          employees: false,
          skills: false,
          positions: false,
          gaps: false,
        });
        setLoading(false);
        return;
      }

      setHasActiveOrg(true);

      // Tenant-scoped checks using activeOrgId
      // Check 2: Employees imported (employees count > 0 for org)
      // Try with is_active filter first, fallback if column doesn't exist
      let employeesQuery = supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("org_id", activeOrgId)
        .eq("is_active", true);
      
      let employeesRes = await employeesQuery;
      
      // If error indicates missing is_active column, retry without it
      if (employeesRes.error) {
        const errorCode = (employeesRes.error as any).code;
        const errorMessage = (employeesRes.error as any).message?.toLowerCase() || "";
        if (errorCode === "42703" || (errorMessage.includes("is_active") && errorMessage.includes("does not exist"))) {
          employeesQuery = supabase
            .from("employees")
            .select("*", { count: "exact", head: true })
            .eq("org_id", activeOrgId);
          employeesRes = await employeesQuery;
        }
      }

      // Check 3: Stations/Lines exist (stations count > 0 for org)
      // Try with is_active filter first, fallback if column doesn't exist
      let stationsQuery = supabase
        .from("stations")
        .select("*", { count: "exact", head: true })
        .eq("org_id", activeOrgId)
        .eq("is_active", true);
      
      let stationsRes = await stationsQuery;
      
      // If error indicates missing is_active column, retry without it
      if (stationsRes.error) {
        const errorCode = (stationsRes.error as any).code;
        const errorMessage = (stationsRes.error as any).message?.toLowerCase() || "";
        if (errorCode === "42703" || (errorMessage.includes("is_active") && errorMessage.includes("does not exist"))) {
          stationsQuery = supabase
            .from("stations")
            .select("*", { count: "exact", head: true })
            .eq("org_id", activeOrgId);
          stationsRes = await stationsQuery;
        }
      }

      const [competencesRes, positionsRes] = await Promise.all([
        // Check 4: Competences exist (competences count > 0 for org)
        supabase
          .from("competences")
          .select("*", { count: "exact", head: true })
          .eq("org_id", activeOrgId),
        
        // Check 5a: Positions exist (positions count > 0 for org)
        supabase
          .from("positions")
          .select("*", { count: "exact", head: true })
          .eq("org_id", activeOrgId),
      ]);

      // Also check org_units for orgUnit step
      const { count: orgUnitsCount } = await supabase
        .from("org_units")
        .select("*", { count: "exact", head: true })
        .eq("org_id", activeOrgId);

      const employeesCount = employeesRes.count || 0;
      if (employeesRes.error && !employeesRes.count) {
        console.error("Error checking employees:", employeesRes.error);
      }

      // Check if positions have requirements by checking if any position has requirements
      // We need to join through positions to get org-scoped requirements
      let hasRequirements = false;
      if (positionsRes.count && positionsRes.count > 0) {
        // Get one position to check if it has requirements
        const { data: samplePosition } = await supabase
          .from("positions")
          .select("id")
          .eq("org_id", activeOrgId)
          .limit(1)
          .single();
        
        if (samplePosition) {
          const { count: reqCount } = await supabase
            .from("position_competence_requirements")
            .select("*", { count: "exact", head: true })
            .eq("position_id", samplePosition.id);
          
          hasRequirements = (reqCount || 0) > 0;
        }
      }

      setProgress({
        orgUnit: (orgUnitsCount || 0) > 0,
        employees: employeesCount > 0,
        skills: (competencesRes.count || 0) > 0,
        positions: (positionsRes.count || 0) > 0 || hasRequirements,
        gaps: false, // Gaps step is manual completion
      });

      setLoading(false);
    }

    checkSetupProgress();
  }, [currentOrg]);

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

  // Show empty state if no active organization
  if (!loading && !hasActiveOrg) {
    return (
      <div className="p-6 max-w-3xl mx-auto" data-testid="setup-page">
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Select organization
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Please select an organization to view setup progress.
            </p>
            <Button onClick={() => router.push("/app/org/select")}>
              Select Organization
            </Button>
          </CardContent>
        </Card>
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
