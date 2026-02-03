"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Calendar,
  MapPin,
  Sun,
  Moon,
  Sunset,
  ChevronDown,
  ChevronRight,
  FileText,
  Link as LinkIcon,
  Save,
  CheckSquare,
  ShieldCheck,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { apiGet, apiPatch, apiPost } from "@/lib/apiClient";

type Task = {
  id: string;
  step_order: number;
  title: string;
  description: string;
  owner_role: string;
  owner_user_id: string | null;
  due_date: string;
  status: string;
  completed_at: string | null;
  notes: string | null;
  evidence_url: string | null;
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
  employeeId: string | null;
  employeeName: string | null;
  shiftDate: string | null;
  shiftType: string | null;
  areaCode: string | null;
  metadata: any;
  status: string;
  startDate: string;
  dueDate: string;
  completedAt: string | null;
  createdAt: string;
  supervisorSignedBy: string | null;
  supervisorSignedAt: string | null;
  supervisorComment: string | null;
  hrSignedBy: string | null;
  hrSignedAt: string | null;
  hrComment: string | null;
  requiresHrSignoff: boolean;
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
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<{
    id: string;
    notes: string;
    evidenceUrl: string;
    dueDate: string;
  } | null>(null);
  const [signoffComment, setSignoffComment] = useState("");
  const [signingOff, setSigningOff] = useState(false);

  const fetchInstance = async () => {
    if (!currentOrg?.id || !params.id) return;

    try {
      const data = await apiGet<WorkflowInstance>(`/api/workflows/instances/${params.id}`);
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
      await apiPatch(`/api/workflows/instances/${params.id}/tasks`, { taskId, status: newStatus });
      await fetchInstance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleSaveTaskDetails = async () => {
    if (!currentOrg?.id || !params.id || !editingTask) return;

    setUpdatingTask(editingTask.id);
    try {
      await apiPatch(`/api/workflows/instances/${params.id}/tasks`, {
        taskId: editingTask.id,
        notes: editingTask.notes,
        evidenceUrl: editingTask.evidenceUrl,
        dueDate: editingTask.dueDate || null,
      });
      await fetchInstance();
      setEditingTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleSignoff = async (type: "supervisor" | "hr") => {
    if (!currentOrg?.id || !params.id) return;

    setSigningOff(true);
    try {
      await apiPost(`/api/workflows/instances/${params.id}/signoff`, { type, comment: signoffComment });
      await fetchInstance();
      setSignoffComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign off");
    } finally {
      setSigningOff(false);
    }
  };

  const startEditingTask = (task: Task) => {
    setEditingTask({
      id: task.id,
      notes: task.notes || "",
      evidenceUrl: task.evidence_url || "",
      dueDate: task.due_date || "",
    });
    setExpandedTask(task.id);
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
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status === "done" || !dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const isDueToday = (dueDate: string, status: string) => {
    if (status === "done" || !dueDate) return false;
    const today = new Date().toDateString();
    return new Date(dueDate).toDateString() === today;
  };

  const allTasksDone = instance?.tasks.every((t) => t.status === "done");
  const canSupervisorSignoff =
    allTasksDone && !instance?.supervisorSignedAt && instance?.status === "active";
  const canHrSignoff =
    instance?.requiresHrSignoff &&
    instance?.supervisorSignedAt &&
    !instance?.hrSignedAt &&
    instance?.status === "active";
  const isLocked = instance?.status === "completed";

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
            {isLocked && (
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                Locked
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
            {instance.employeeName && (
              <span className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {instance.employeeName}
              </span>
            )}
            {instance.shiftDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(instance.shiftDate)}
              </span>
            )}
            {instance.shiftType && (
              <span className="flex items-center gap-1">
                {instance.shiftType === "Day" ? (
                  <Sun className="h-4 w-4" />
                ) : instance.shiftType === "Evening" ? (
                  <Sunset className="h-4 w-4" />
                ) : (
                  <Moon className="h-4 w-4" />
                )}
                {instance.shiftType}
              </span>
            )}
            {instance.areaCode && (
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {instance.areaCode}
              </span>
            )}
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
              {instance.progress.done}/{instance.progress.total} tasks ({instance.progress.percent}
              %)
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
          <div className="space-y-3">
            {instance.tasks.map((task) => (
              <Collapsible
                key={task.id}
                open={expandedTask === task.id}
                onOpenChange={(open) => setExpandedTask(open ? task.id : null)}
              >
                <div
                  className="border rounded-lg overflow-hidden"
                  data-testid={`task-${task.step_order}`}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start gap-4 p-4 cursor-pointer hover-elevate">
                      <div className="flex-shrink-0 mt-1">{getTaskIcon(task.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium">{task.title}</h3>
                          {isOverdue(task.due_date, task.status) && (
                            <Badge variant="destructive" className="text-xs">
                              Overdue
                            </Badge>
                          )}
                          {isDueToday(task.due_date, task.status) && (
                            <Badge className="bg-amber-500 text-xs">Due Today</Badge>
                          )}
                          {task.notes && (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          {task.evidence_url && (
                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.owner_role}
                          </span>
                          {task.due_date && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Due {formatDate(task.due_date)}
                            </span>
                          )}
                          {task.completed_at && (
                            <span className="text-green-600">
                              Completed {formatDateTime(task.completed_at)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleTaskStatusChange(task.id, value)}
                          disabled={updatingTask === task.id || isLocked}
                        >
                          <SelectTrigger
                            className="w-[130px]"
                            data-testid={`select-task-status-${task.step_order}`}
                            onClick={(e) => e.stopPropagation()}
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
                        {expandedTask === task.id ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                      {task.description && (
                        <p className="text-sm text-muted-foreground py-3">{task.description}</p>
                      )}

                      {editingTask?.id === task.id ? (
                        <div className="space-y-4 pt-3">
                          <div>
                            <label className="text-sm font-medium mb-1 block">Due Date</label>
                            <Input
                              type="date"
                              value={editingTask.dueDate}
                              onChange={(e) =>
                                setEditingTask({ ...editingTask, dueDate: e.target.value })
                              }
                              disabled={isLocked}
                              data-testid="input-task-due-date"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1 block">Notes</label>
                            <Textarea
                              placeholder="Add notes about this task..."
                              value={editingTask.notes}
                              onChange={(e) =>
                                setEditingTask({ ...editingTask, notes: e.target.value })
                              }
                              rows={3}
                              disabled={isLocked}
                              data-testid="input-task-notes"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-medium mb-1 block">
                              Evidence URL
                            </label>
                            <Input
                              placeholder="https://..."
                              value={editingTask.evidenceUrl}
                              onChange={(e) =>
                                setEditingTask({ ...editingTask, evidenceUrl: e.target.value })
                              }
                              disabled={isLocked}
                              data-testid="input-task-evidence"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={handleSaveTaskDetails}
                              disabled={updatingTask === task.id || isLocked}
                              data-testid="button-save-task"
                            >
                              {updatingTask === task.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              ) : (
                                <Save className="h-4 w-4 mr-2" />
                              )}
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setEditingTask(null)}
                              data-testid="button-cancel-edit"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3 pt-3">
                          {task.notes && (
                            <div>
                              <span className="text-sm font-medium">Notes:</span>
                              <p className="text-sm text-muted-foreground mt-1">{task.notes}</p>
                            </div>
                          )}
                          {task.evidence_url && (
                            <div>
                              <span className="text-sm font-medium">Evidence:</span>
                              <a
                                href={task.evidence_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline ml-2"
                              >
                                {task.evidence_url}
                              </a>
                            </div>
                          )}
                          {!isLocked && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditingTask(task)}
                              data-testid={`button-edit-task-${task.step_order}`}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Edit Details
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      {(canSupervisorSignoff || canHrSignoff || instance.supervisorSignedAt) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Sign-off
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {instance.supervisorSignedAt ? (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                  <ShieldCheck className="h-5 w-5" />
                  Supervisor Sign-off Complete
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Signed at {formatDateTime(instance.supervisorSignedAt)}
                </p>
                {instance.supervisorComment && (
                  <p className="text-sm mt-2">Comment: {instance.supervisorComment}</p>
                )}
              </div>
            ) : canSupervisorSignoff ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  All tasks are complete. Sign off to finalize this workflow.
                </p>
                <Textarea
                  placeholder="Add a comment (optional)..."
                  value={signoffComment}
                  onChange={(e) => setSignoffComment(e.target.value)}
                  rows={2}
                  data-testid="input-signoff-comment"
                />
                <Button
                  onClick={() => handleSignoff("supervisor")}
                  disabled={signingOff}
                  data-testid="button-supervisor-signoff"
                >
                  {signingOff ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  Supervisor Sign-off
                </Button>
              </div>
            ) : null}

            {instance.requiresHrSignoff && (
              <>
                {instance.hrSignedAt ? (
                  <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                      <ShieldCheck className="h-5 w-5" />
                      HR Sign-off Complete
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Signed at {formatDateTime(instance.hrSignedAt)}
                    </p>
                    {instance.hrComment && (
                      <p className="text-sm mt-2">Comment: {instance.hrComment}</p>
                    )}
                  </div>
                ) : canHrSignoff ? (
                  <div className="space-y-3 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      HR sign-off required to complete this workflow.
                    </p>
                    <Textarea
                      placeholder="Add a comment (optional)..."
                      value={signoffComment}
                      onChange={(e) => setSignoffComment(e.target.value)}
                      rows={2}
                    />
                    <Button
                      onClick={() => handleSignoff("hr")}
                      disabled={signingOff}
                      data-testid="button-hr-signoff"
                    >
                      {signingOff ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      HR Sign-off
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}

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
