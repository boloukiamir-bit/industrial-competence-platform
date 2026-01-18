"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Play, Clock, User, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { apiGet } from "@/lib/apiClient";

type WorkflowInstance = {
  id: string;
  templateId: string;
  templateName: string;
  templateCategory: string;
  employeeId: string;
  employeeName: string;
  status: string;
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  progress: {
    total: number;
    done: number;
    percent: number;
  };
};

type StatusCounts = {
  active: number;
  completed: number;
  cancelled: number;
};

export default function WorkflowInstancesPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({ active: 0, completed: 0, cancelled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    if (!currentOrg?.id) return;

    async function fetchInstances() {
      try {
        const queryParams = new URLSearchParams();
        if (statusFilter !== "all") queryParams.set("status", statusFilter);

        const data = await apiGet<{ instances: WorkflowInstance[]; statusCounts: StatusCounts }>(
          `/api/workflows/instances?${queryParams.toString()}`
        );
        setInstances(data.instances || []);
        setStatusCounts(data.statusCounts || { active: 0, completed: 0, cancelled: 0 });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load instances");
      } finally {
        setLoading(false);
      }
    }

    fetchInstances();
  }, [currentOrg?.id, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-blue-500">Active</Badge>;
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-instances">
            Active Workflows
          </h1>
          <p className="text-muted-foreground">
            Track and manage ongoing HR processes
          </p>
        </div>
        <Button 
          variant="outline"
          onClick={() => router.push("/app/workflows/templates")}
          data-testid="button-view-templates"
        >
          <Play className="mr-2 h-4 w-4" />
          Start New Workflow
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("active")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{statusCounts.active}</div>
            <div className="text-sm text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("completed")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{statusCounts.completed}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover-elevate" onClick={() => setStatusFilter("cancelled")}>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-500">{statusCounts.cancelled}</div>
            <div className="text-sm text-muted-foreground">Cancelled</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {instances.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No workflow instances found. Start a new workflow from a template.
            </p>
            <Button 
              className="mt-4" 
              onClick={() => router.push("/app/workflows/templates")}
            >
              Browse Templates
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {instances.map((instance) => (
            <Card
              key={instance.id}
              className="cursor-pointer hover-elevate"
              onClick={() => router.push(`/app/workflows/instances/${instance.id}`)}
              data-testid={`card-instance-${instance.id}`}
            >
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{instance.templateName}</h3>
                      {getStatusBadge(instance.status)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {instance.employeeName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        Started {formatDate(instance.startDate)}
                      </span>
                      {instance.dueDate && (
                        <span>Due {formatDate(instance.dueDate)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">
                      {instance.progress.done}/{instance.progress.total}
                    </div>
                    <div className="text-sm text-muted-foreground">tasks done</div>
                  </div>
                </div>
                <Progress value={instance.progress.percent} className="h-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
