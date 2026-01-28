"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Calendar, Clock, MapPin, X } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getMeetingsForEmployee, createMeeting } from "@/services/oneToOne";
import type { OneToOneMeeting, Employee } from "@/types/domain";
import { useOrg } from "@/hooks/useOrg";

export default function EmployeeOneToOnesPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const { currentOrg } = useOrg();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [meetings, setMeetings] = useState<OneToOneMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    managerId: "",
    scheduledAt: "",
    durationMinutes: 60,
    location: "",
    templateName: "",
    sharedAgenda: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!currentOrg) {
        setEmployee(null);
        setMeetings([]);
        setManagers([]);
        setLoading(false);
        return;
      }
      const [empRes, meetingsData, managersRes] = await Promise.all([
        supabase.from("employees").select("*").eq("org_id", currentOrg.id).eq("id", employeeId).single(),
        getMeetingsForEmployee(employeeId),
        supabase.from("employees").select("id, name").eq("org_id", currentOrg.id).eq("is_active", true).order("name"),
      ]);

      if (empRes.data) {
        setEmployee({
          id: empRes.data.id,
          name: empRes.data.name || "",
          employeeNumber: empRes.data.employee_number || "",
          role: empRes.data.role || "",
          line: empRes.data.line || "",
          team: empRes.data.team || "",
          employmentType: empRes.data.employment_type || "permanent",
          isActive: empRes.data.is_active ?? true,
          managerId: empRes.data.manager_id || undefined,
        });
        if (empRes.data.manager_id) {
          setFormData((prev) => ({ ...prev, managerId: empRes.data.manager_id }));
        }
      }

      setMeetings(meetingsData);
      setManagers((managersRes.data || []).map((m) => ({ id: m.id, name: m.name })));
      setLoading(false);
    }
    loadData();
  }, [employeeId, currentOrg]);

  async function handleCreate() {
    if (!formData.managerId || !formData.scheduledAt) return;

    setSaving(true);
    const result = await createMeeting({
      employeeId,
      managerId: formData.managerId,
      scheduledAt: new Date(formData.scheduledAt).toISOString(),
      durationMinutes: formData.durationMinutes || undefined,
      location: formData.location || undefined,
      templateName: formData.templateName || undefined,
      sharedAgenda: formData.sharedAgenda || undefined,
      orgId: currentOrg?.id,
    });

    if (result) {
      setMeetings([result, ...meetings]);
      setShowNewForm(false);
      setFormData({
        managerId: employee?.managerId || "",
        scheduledAt: "",
        durationMinutes: 60,
        location: "",
        templateName: "",
        sharedAgenda: "",
      });
    }
    setSaving(false);
  }

  function getStatusBadge(status: string) {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      planned: "outline",
      in_progress: "default",
      completed: "secondary",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/app/employees/${employeeId}`}>
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            1:1 Meetings
          </h1>
          <p className="text-muted-foreground">{employee?.name}</p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setShowNewForm(true)} data-testid="button-schedule-new">
          <Plus className="h-4 w-4 mr-2" />
          Schedule New 1:1
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Schedule New Meeting</CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNewForm(false)}
              data-testid="button-close-form"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Manager</label>
                <Select
                  value={formData.managerId}
                  onValueChange={(v) => setFormData({ ...formData, managerId: v })}
                >
                  <SelectTrigger data-testid="select-manager">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date & Time</label>
                <Input
                  type="datetime-local"
                  value={formData.scheduledAt}
                  onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  data-testid="input-scheduled-at"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Duration (minutes)</label>
                <Input
                  type="number"
                  value={formData.durationMinutes}
                  onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) || 60 })}
                  data-testid="input-duration"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Location</label>
                <Input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Meeting room, online, etc."
                  data-testid="input-location"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template</label>
                <Select
                  value={formData.templateName}
                  onValueChange={(v) => setFormData({ ...formData, templateName: v })}
                >
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medarbetarsamtal">Medarbetarsamtal</SelectItem>
                    <SelectItem value="Lönesamtal">Lönesamtal</SelectItem>
                    <SelectItem value="Uppföljning">Uppföljning</SelectItem>
                    <SelectItem value="Check-in">Check-in</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Shared Agenda</label>
              <Textarea
                value={formData.sharedAgenda}
                onChange={(e) => setFormData({ ...formData, sharedAgenda: e.target.value })}
                placeholder="Topics to discuss..."
                rows={3}
                data-testid="input-agenda"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewForm(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={saving || !formData.managerId || !formData.scheduledAt}
                data-testid="button-create-meeting"
              >
                {saving ? "Creating..." : "Create Meeting"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {meetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No 1:1 meetings scheduled yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => (
            <Link key={meeting.id} href={`/app/one-to-ones/${meeting.id}`}>
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span data-testid={`text-meeting-date-${meeting.id}`}>
                          {new Date(meeting.scheduledAt).toLocaleDateString("sv-SE")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>
                          {new Date(meeting.scheduledAt).toLocaleTimeString("sv-SE", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {meeting.location && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{meeting.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {meeting.templateName && (
                        <span className="text-sm text-muted-foreground">{meeting.templateName}</span>
                      )}
                      <span className="text-sm">with {meeting.managerName || "Manager"}</span>
                      {getStatusBadge(meeting.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
