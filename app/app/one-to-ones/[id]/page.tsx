"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Calendar, Clock, MapPin, User, CheckCircle2 } from "lucide-react";
import {
  getMeetingById,
  getActionsForMeeting,
  updateMeeting,
  addAction,
  completeAction,
} from "@/services/oneToOne";
import type { OneToOneMeeting, OneToOneAction, OneToOneActionOwner } from "@/types/domain";

export default function OneToOneMeetingPage() {
  const params = useParams();
  const router = useRouter();
  const meetingId = params.id as string;

  const [meeting, setMeeting] = useState<OneToOneMeeting | null>(null);
  const [actions, setActions] = useState<OneToOneAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [sharedAgenda, setSharedAgenda] = useState("");
  const [managerNotes, setManagerNotes] = useState("");
  const [employeeNotes, setEmployeeNotes] = useState("");

  const [newActionDesc, setNewActionDesc] = useState("");
  const [newActionOwner, setNewActionOwner] = useState<OneToOneActionOwner>("employee");
  const [newActionDue, setNewActionDue] = useState("");

  useEffect(() => {
    async function loadData() {
      const [meetingData, actionsData] = await Promise.all([
        getMeetingById(meetingId),
        getActionsForMeeting(meetingId),
      ]);

      if (meetingData) {
        setMeeting(meetingData);
        setSharedAgenda(meetingData.sharedAgenda || "");
        setManagerNotes(meetingData.managerNotesPrivate || "");
        setEmployeeNotes(meetingData.employeeNotesPrivate || "");
      }
      setActions(actionsData);
      setLoading(false);
    }
    loadData();
  }, [meetingId]);

  async function handleSaveNotes() {
    if (!meeting) return;
    setSaving(true);
    await updateMeeting(meetingId, {
      sharedAgenda,
      managerNotesPrivate: managerNotes,
      employeeNotesPrivate: employeeNotes,
    });
    setSaving(false);
  }

  async function handleStatusChange(status: OneToOneMeeting["status"]) {
    if (!meeting) return;
    setSaving(true);
    const success = await updateMeeting(meetingId, { status });
    if (success) {
      setMeeting({ ...meeting, status });
    }
    setSaving(false);
  }

  async function handleAddAction() {
    if (!newActionDesc.trim()) return;
    setSaving(true);
    const result = await addAction(meetingId, {
      description: newActionDesc,
      ownerType: newActionOwner,
      dueDate: newActionDue || undefined,
    });
    if (result) {
      setActions([...actions, result]);
      setNewActionDesc("");
      setNewActionDue("");
    }
    setSaving(false);
  }

  async function handleCompleteAction(actionId: string) {
    const success = await completeAction(actionId);
    if (success) {
      setActions(actions.map((a) => (a.id === actionId ? { ...a, isCompleted: true } : a)));
    }
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      planned: "outline",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status.replace("_", " ")}</Badge>;
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Meeting not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/app/employees/${meeting.employeeId}/one-to-ones`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              {meeting.templateName || "1:1 Meeting"}
            </h1>
            {getStatusBadge(meeting.status)}
          </div>
          <div className="flex items-center gap-4 text-muted-foreground mt-1 flex-wrap">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span>{meeting.employeeName} with {meeting.managerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{new Date(meeting.scheduledAt).toLocaleDateString("sv-SE")}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {new Date(meeting.scheduledAt).toLocaleTimeString("sv-SE", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {meeting.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{meeting.location}</span>
              </div>
            )}
          </div>
        </div>
        <Select
          value={meeting.status}
          onValueChange={(v) => handleStatusChange(v as OneToOneMeeting["status"])}
        >
          <SelectTrigger className="w-40" data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="before" className="space-y-4">
        <TabsList>
          <TabsTrigger value="before" data-testid="tab-before">Before</TabsTrigger>
          <TabsTrigger value="during" data-testid="tab-during">During</TabsTrigger>
          <TabsTrigger value="after" data-testid="tab-after">After</TabsTrigger>
        </TabsList>

        <TabsContent value="before" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shared Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={sharedAgenda}
                onChange={(e) => setSharedAgenda(e.target.value)}
                placeholder="Topics both parties want to discuss..."
                rows={4}
                data-testid="input-shared-agenda"
              />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Employee Private Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={employeeNotes}
                  onChange={(e) => setEmployeeNotes(e.target.value)}
                  placeholder="Private notes for employee..."
                  rows={4}
                  data-testid="input-employee-notes"
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Manager Private Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Private notes for manager..."
                  rows={4}
                  data-testid="input-manager-notes"
                />
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveNotes} disabled={saving} data-testid="button-save-notes">
              {saving ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="during" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discussion Points & Agenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-4 rounded-md whitespace-pre-wrap">
                {sharedAgenda || "No agenda set"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Action Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={newActionDesc}
                  onChange={(e) => setNewActionDesc(e.target.value)}
                  placeholder="New action item..."
                  className="flex-1 min-w-48"
                  data-testid="input-new-action"
                />
                <Select
                  value={newActionOwner}
                  onValueChange={(v) => setNewActionOwner(v as OneToOneActionOwner)}
                >
                  <SelectTrigger className="w-32" data-testid="select-action-owner">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="date"
                  value={newActionDue}
                  onChange={(e) => setNewActionDue(e.target.value)}
                  className="w-40"
                  data-testid="input-action-due"
                />
                <Button onClick={handleAddAction} disabled={!newActionDesc.trim()} data-testid="button-add-action">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {actions.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No action items yet</p>
              ) : (
                <div className="space-y-2">
                  {actions.map((action) => (
                    <div
                      key={action.id}
                      className={`flex items-start gap-3 p-3 rounded-md border ${
                        action.isCompleted ? "bg-muted/50" : ""
                      }`}
                    >
                      <Checkbox
                        checked={action.isCompleted}
                        onCheckedChange={() => !action.isCompleted && handleCompleteAction(action.id)}
                        data-testid={`checkbox-action-${action.id}`}
                      />
                      <div className="flex-1">
                        <p className={action.isCompleted ? "line-through text-muted-foreground" : ""}>
                          {action.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {action.ownerType}
                          </Badge>
                          {action.dueDate && <span>Due: {action.dueDate}</span>}
                        </div>
                      </div>
                      {action.isCompleted && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="after" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Meeting Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Discussed Topics</h4>
                <div className="bg-muted p-4 rounded-md whitespace-pre-wrap">
                  {sharedAgenda || "No agenda recorded"}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">
                  Action Items ({actions.filter((a) => a.isCompleted).length}/{actions.length} completed)
                </h4>
                {actions.length === 0 ? (
                  <p className="text-muted-foreground">No action items</p>
                ) : (
                  <div className="space-y-2">
                    {actions.map((action) => (
                      <div
                        key={action.id}
                        className="flex items-center gap-3 p-2 rounded-md border"
                      >
                        {action.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2" />
                        )}
                        <span className={action.isCompleted ? "line-through text-muted-foreground" : ""}>
                          {action.description}
                        </span>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {action.ownerType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {meeting.status !== "completed" && (
                <Button
                  onClick={() => handleStatusChange("completed")}
                  className="w-full"
                  data-testid="button-complete-meeting"
                >
                  Mark Meeting as Completed
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
