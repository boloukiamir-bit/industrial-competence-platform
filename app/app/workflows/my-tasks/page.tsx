"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Clock,
  User,
  CheckCircle,
  Circle,
  PlayCircle,
  AlertCircle,
  Loader2,
  AlertTriangle,
  Calendar,
  MapPin,
  FileText,
  ExternalLink,
  Save,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { apiGet, apiPatch } from "@/lib/apiClient";

type Task = {
  id: string;
  instanceId: string;
  stepNo: number;
  title: string;
  description: string;
  ownerRole: string;
  ownerUserId: string | null;
  dueDate: string;
  status: string;
  notes: string | null;
  evidenceUrl: string | null;
  completedAt: string | null;
  employeeName: string | null;
  instanceStatus: string;
  areaCode: string | null;
  templateName: string;
  templateCategory: string;
  isOverdue: boolean;
  isDueToday: boolean;
};

export default function MyTasksPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState({ total: 0, overdue: 0, dueToday: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTask, setUpdatingTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [filter, setFilter] = useState<"all" | "overdue" | "today">("all");

  const fetchTasks = async () => {
    if (!currentOrg?.id) return;

    try {
      const data = await apiGet<{ tasks: Task[]; summary: { total: number; overdue: number; dueToday: number } }>("/api/workflows/my-tasks");
      setTasks(data.tasks);
      setSummary(data.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [currentOrg?.id]);

  const handleStatusChange = async (task: Task, newStatus: string) => {
    if (!currentOrg?.id) return;

    setUpdatingTask(task.id);
    try {
      await apiPatch(`/api/workflows/instances/${task.instanceId}/tasks`, { taskId: task.id, status: newStatus });
      await fetchTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setUpdatingTask(null);
    }
  };

  const handleSaveNote = async () => {
    if (!currentOrg?.id || !editingTask) return;

    setUpdatingTask(editingTask.id);
    try {
      await apiPatch(`/api/workflows/instances/${editingTask.instanceId}/tasks`, { taskId: editingTask.id, notes: editNotes });
      await fetchTasks();
      setEditingTask(null);
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
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "overdue") return task.isOverdue;
    if (filter === "today") return task.isDueToday;
    return true;
  });

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
          <h1 className="text-2xl font-bold" data-testid="heading-my-tasks">
            My Tasks
          </h1>
          <p className="text-muted-foreground">Tasks across all active workflows</p>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer hover-elevate ${filter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setFilter("all")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-3xl font-bold" data-testid="count-total-tasks">
                  {summary.total}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover-elevate ${filter === "overdue" ? "ring-2 ring-destructive" : ""}`}
          onClick={() => setFilter("overdue")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-destructive" data-testid="count-overdue-tasks">
                  {summary.overdue}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer hover-elevate ${filter === "today" ? "ring-2 ring-amber-500" : ""}`}
          onClick={() => setFilter("today")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due Today</p>
                <p className="text-3xl font-bold text-amber-600" data-testid="count-due-today">
                  {summary.dueToday}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {filter === "all"
              ? "All Tasks"
              : filter === "overdue"
              ? "Overdue Tasks"
              : "Due Today"}
            ({filteredTasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {filter === "all"
                ? "No pending tasks. Great job!"
                : filter === "overdue"
                ? "No overdue tasks."
                : "No tasks due today."}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover-elevate"
                  data-testid={`task-row-${task.id}`}
                >
                  <div className="flex-shrink-0 mt-1">{getTaskIcon(task.status)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-medium">{task.title}</h3>
                      {task.isOverdue && (
                        <Badge variant="destructive" className="text-xs">
                          Overdue
                        </Badge>
                      )}
                      {task.isDueToday && !task.isOverdue && (
                        <Badge className="bg-amber-500 text-xs">Due Today</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      {task.templateName}
                      {task.employeeName && ` - ${task.employeeName}`}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {task.ownerRole}
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due {formatDate(task.dueDate)}
                        </span>
                      )}
                      {task.areaCode && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {task.areaCode}
                        </span>
                      )}
                      {task.notes && <FileText className="h-3 w-3" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTask(task);
                        setEditNotes(task.notes || "");
                      }}
                      data-testid={`button-add-note-${task.id}`}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/app/workflows/instances/${task.instanceId}`)}
                      data-testid={`button-view-instance-${task.id}`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleStatusChange(task, value)}
                      disabled={updatingTask === task.id}
                    >
                      <SelectTrigger
                        className="w-[130px]"
                        data-testid={`select-status-${task.id}`}
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
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1">{editingTask?.title}</p>
              <p className="text-sm text-muted-foreground">{editingTask?.templateName}</p>
            </div>
            <Textarea
              placeholder="Add notes about this task..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              data-testid="input-quick-note"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditingTask(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveNote}
                disabled={updatingTask === editingTask?.id}
                data-testid="button-save-note"
              >
                {updatingTask === editingTask?.id ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
