"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  ArrowRight,
  LayoutGrid,
  ListTodo,
  Briefcase,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";

type TemplateCount = {
  templateName: string;
  category: string;
  count: number;
};

type RecentInstance = {
  id: string;
  employeeName: string | null;
  status: string;
  startDate: string;
  dueDate: string | null;
  updatedAt: string;
  areaCode: string | null;
  templateName: string;
  templateCategory: string;
  progress: {
    total: number;
    done: number;
    percent: number;
  };
};

type DashboardData = {
  activeWorkflows: number;
  overdueTasks: number;
  completedToday: number;
  byTemplate: TemplateCount[];
  recentInstances: RecentInstance[];
};

export default function WorkflowDashboardPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!currentOrg?.id) return;

      try {
        const res = await fetch("/api/workflows/dashboard", {
          headers: { "x-org-id": currentOrg.id },
        });
        if (!res.ok) throw new Error("Failed to fetch dashboard");
        const result = await res.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [currentOrg?.id]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || "Failed to load dashboard"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-workflow-dashboard">
            Workflow Dashboard
          </h1>
          <p className="text-muted-foreground">Overview of workflow activity</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/app/workflows/my-tasks")}
            data-testid="button-goto-my-tasks"
          >
            <ListTodo className="h-4 w-4 mr-2" />
            My Tasks
          </Button>
          <Button
            onClick={() => router.push("/app/workflows/templates")}
            data-testid="button-goto-templates"
          >
            <LayoutGrid className="h-4 w-4 mr-2" />
            Templates
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover-elevate cursor-pointer" onClick={() => router.push("/app/workflows/instances")}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Workflows</p>
                <p className="text-3xl font-bold" data-testid="count-active-workflows">
                  {data.activeWorkflows}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card
          className="hover-elevate cursor-pointer"
          onClick={() => router.push("/app/workflows/my-tasks")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                <p
                  className={`text-3xl font-bold ${data.overdueTasks > 0 ? "text-destructive" : ""}`}
                  data-testid="count-overdue-tasks"
                >
                  {data.overdueTasks}
                </p>
              </div>
              <AlertTriangle
                className={`h-8 w-8 ${data.overdueTasks > 0 ? "text-destructive" : "text-muted-foreground"}`}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-3xl font-bold text-green-600" data-testid="count-completed-today">
                  {data.completedToday}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Active by Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.byTemplate.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No active workflows</p>
            ) : (
              <div className="space-y-3">
                {data.byTemplate.map((template, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{template.templateName}</p>
                      <p className="text-xs text-muted-foreground capitalize">{template.category}</p>
                    </div>
                    <Badge variant="secondary" className="text-lg px-3">
                      {template.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/app/workflows/instances")}
            >
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentInstances.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {data.recentInstances.slice(0, 5).map((instance) => (
                  <div
                    key={instance.id}
                    className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover-elevate"
                    onClick={() => router.push(`/app/workflows/instances/${instance.id}`)}
                    data-testid={`recent-instance-${instance.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{instance.templateName}</p>
                        <Badge
                          className={
                            instance.status === "active"
                              ? "bg-blue-500"
                              : instance.status === "completed"
                              ? "bg-green-500"
                              : ""
                          }
                        >
                          {instance.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        {instance.employeeName && <span>{instance.employeeName}</span>}
                        {instance.areaCode && <span>- {instance.areaCode}</span>}
                        <span className="ml-auto">{formatRelativeTime(instance.updatedAt)}</span>
                      </div>
                      <Progress value={instance.progress.percent} className="h-1.5 mt-2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
