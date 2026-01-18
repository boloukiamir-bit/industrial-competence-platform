"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
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
import {
  ArrowLeft,
  Clock,
  User,
  CheckCircle,
  Circle,
  PlayCircle,
  AlertCircle,
  Loader2,
  History,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";

type Task = {
  id: string;
  step_no: number;
  title: string;
  description: string;
  owner_role: string;
  owner_user_id: string | null;
  due_date: string;
  status: string;
  completed_at: string | null;
};

type AuditLogEntry = {
  id: string;
  action: string;
  actor_email: string | null;
  metadata: any;
  created_at: string;
};

type WorkflowInstance = {
  id: string;
  templateId: string;
  templateName: string;
  templateDescription: string;
  templateCategory: string;
  employeeId: string;
  employeeName: string;
  status: string;
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  tasks: Task[];
  progress: {
    total: number;
    done: number;
    percent: number;
  };
  auditLog: AuditLogEntry[];
};

export default function InstanceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentOrg } = useOrg();
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);

  const fetchInstance = async () => {
    if (!currentOrg?.id || !params.id) return;

    try {
      const res = await fetch(`/api/workflows/instances/${params.id}`, {
        headers: { "x-org-id": currentOrg.id },
      });
      if (!res.ok) throw new Error("Failed to fetch instance");
      const data = await res.json();
      setInstance(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load instance");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstance();
  }, [currentOrg?.id, params.id]);

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    if (!currentOrg?.id || !params.id) return;

    setUpdatingTask(taskId);
    try {
      const res = await fetch(`/api/workflows/instances/${params.id}/tasks`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": currentOrg.id,
        },
        body: JSON.stringify({ taskId, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update task");

      await fetchInstance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  };

  const getTaskIcon = (status: string) => {
    switch (status) {
      case "done":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "in_progress":
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      case "blocked":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "done":
        return <Badge className="bg-green-500">Done</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case "blocked":
        return <Badge variant="destructive">Blocked</Badge>;
      default:
        return <Badge variant="outline">To Do</Badge>;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || "Instance not found"}</p>
            <Button className="mt-4" onClick={() => router.push("/app/workflows/instances")}>
              Back to Instances
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/app/workflows/instances")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="heading-instance">
              {instance.templateName}
            </h1>
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
          <div className="flex items-center gap-4 text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {instance.employeeName}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Started {formatDate(instance.startDate)}
            </span>
            {instance.dueDate && <span>Due {formatDate(instance.dueDate)}</span>}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">
              {instance.progress.done}/{instance.progress.total} tasks ({instance.progress.percent}%)
            </span>
          </div>
          <Progress value={instance.progress.percent} className="h-3" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tasks ({instance.tasks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {instance.tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
                data-testid={`task-${task.step_no}`}
              >
                <div className="flex-shrink-0 mt-1">{getTaskIcon(task.status)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{task.title}</h3>
                  </div>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.owner_role}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due {formatDate(task.due_date)}
                    </span>
                    {task.completed_at && (
                      <span className="text-green-600">
                        Completed {formatDateTime(task.completed_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Select
                    value={task.status}
                    onValueChange={(value) => handleTaskStatusChange(task.id, value)}
                    disabled={updatingTask === task.id}
                  >
                    <SelectTrigger
                      className="w-[140px]"
                      data-testid={`select-task-status-${task.step_no}`}
                    >
                      {updatingTask === task.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SelectValue />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Audit Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {instance.auditLog.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No audit entries yet</p>
          ) : (
            <div className="space-y-3">
              {instance.auditLog.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 text-sm border-b pb-3">
                  <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <div className="font-medium">
                      {entry.action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}
                    </div>
                    {entry.metadata?.taskTitle && (
                      <div className="text-muted-foreground">Task: {entry.metadata.taskTitle}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(entry.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
