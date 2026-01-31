"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Play,
  RefreshCw,
  Copy,
  CheckCircle,
  Circle,
  Shield,
  ExternalLink,
} from "lucide-react";
import {
  isDemoMode,
  enableDemoMode,
  disableDemoMode,
  getDemoScript,
  getDemoMetrics,
  DEMO_CHECKLIST,
} from "@/lib/demoRuntime";
import Link from "next/link";

export default function DemoCenterPage() {
  const [demoActive, setDemoActive] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const metrics = getDemoMetrics();

  useEffect(() => {
    setDemoActive(isDemoMode());
  }, []);

  const handleEnableDemo = () => {
    enableDemoMode();
    setDemoActive(true);
    window.location.reload();
  };

  const handleDisableDemo = () => {
    disableDemoMode();
    setDemoActive(false);
    window.location.reload();
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(getDemoScript());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const toggleStep = (step: number) => {
    setCheckedSteps((prev) =>
      prev.includes(step) ? prev.filter((s) => s !== step) : [...prev, step]
    );
  };

  const completedCount = checkedSteps.length;
  const totalSteps = DEMO_CHECKLIST.length;
  const progress = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Demo Control Center
          </h1>
          <p className="text-muted-foreground">
            Prepare and execute a flawless product demo
          </p>
        </div>
        <Badge
          variant={demoActive ? "default" : "secondary"}
          className="text-sm px-3 py-1"
          data-testid="badge-demo-status"
        >
          <Shield className="h-4 w-4 mr-1" />
          {demoActive ? "Demo Active" : "Demo Inactive"}
        </Badge>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Demo Mode Controls
            </CardTitle>
            <CardDescription>
              Enable demo mode to use pre-configured demo data without Supabase calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {demoActive ? (
                <Button
                  variant="outline"
                  onClick={handleDisableDemo}
                  data-testid="button-disable-demo"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Disable Demo Mode
                </Button>
              ) : (
                <Button onClick={handleEnableDemo} data-testid="button-enable-demo">
                  <Play className="h-4 w-4 mr-2" />
                  Enable Demo Mode
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
                data-testid="button-reset-demo"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset Demo Data
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyScript}
                data-testid="button-copy-script"
              >
                {copySuccess ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <Copy className="h-4 w-4 mr-2" />
                )}
                {copySuccess ? "Copied!" : "Copy Demo Script"}
              </Button>
            </div>

            {demoActive && (
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  Demo mode is active. All data shown is pre-configured demo data.
                  Navigate to any page to see demo content.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo Metrics Preview</CardTitle>
            <CardDescription>
              These metrics will be shown on the Dashboard in demo mode
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted rounded-md">
                <div className="text-2xl font-bold" data-testid="text-demo-employees">
                  {metrics.totalEmployees}
                </div>
                <div className="text-sm text-muted-foreground">Employees</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <div className="text-2xl font-bold text-amber-600" data-testid="text-demo-at-risk">
                  {metrics.atRiskCount}
                </div>
                <div className="text-sm text-muted-foreground">At Risk</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <div className="text-2xl font-bold" data-testid="text-demo-readiness">
                  {metrics.avgReadiness}%
                </div>
                <div className="text-sm text-muted-foreground">Readiness</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-md">
                <div className="text-2xl font-bold" data-testid="text-demo-gaps">
                  {metrics.gapCount}
                </div>
                <div className="text-sm text-muted-foreground">Skill Gaps</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Demo Checklist</CardTitle>
            <CardDescription>
              Follow these steps to deliver a flawless demo ({completedCount}/{totalSteps} complete - {progress}%)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {DEMO_CHECKLIST.map((item) => {
                const isChecked = checkedSteps.includes(item.step);
                return (
                  <div
                    key={item.step}
                    className="flex items-start gap-3 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => toggleStep(item.step)}
                  >
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleStep(item.step)}
                      data-testid={`checkbox-step-${item.step}`}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {isChecked ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className={`font-medium ${isChecked ? "line-through text-muted-foreground" : ""}`}>
                          Step {item.step}: {item.title}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Navigation</CardTitle>
            <CardDescription>
              Jump directly to demo pages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/dashboard" data-testid="link-demo-dashboard">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Dashboard
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/employees" data-testid="link-demo-employees">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Employees
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/org/overview" data-testid="link-demo-org">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Organization
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/competence/matrix" data-testid="link-demo-matrix">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Competence Matrix
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/tomorrows-gaps" data-testid="link-demo-gaps">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Tomorrow&apos;s Gaps
                </Link>
              </Button>
              <Button asChild variant="outline" className="justify-start">
                <Link href="/app/admin/users" data-testid="link-demo-users">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Admin Users
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
