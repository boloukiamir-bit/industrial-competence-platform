"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Calendar, Users, Clock, MapPin, Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { getAllMeetings, createMeeting } from "@/services/oneToOne";
import type { OneToOneMeeting, OneToOneMeetingStatus, Employee } from "@/types/domain";

const statusColors: Record<OneToOneMeetingStatus, string> = {
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const statusLabels: Record<OneToOneMeetingStatus, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OneToOnesListPage() {
  const [meetings, setMeetings] = useState<OneToOneMeeting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [newMeeting, setNewMeeting] = useState({
    employeeId: "",
    managerId: "",
    scheduledAt: "",
    durationMinutes: "60",
    location: "",
    templateName: "Medarbetarsamtal",
    sharedAgenda: "",
  });

  useEffect(() => {
    async function loadData() {
      const [meetingsData, employeesRes] = await Promise.all([
        getAllMeetings(),
        supabase.from("employees").select("id, name, role").eq("is_active", true).order("name"),
      ]);
      
      setMeetings(meetingsData);
      setEmployees(
        (employeesRes.data || []).map((e) => ({
          id: e.id,
          name: e.name || "",
          employeeNumber: "",
          role: e.role || "",
          line: "",
          team: "",
          employmentType: "permanent" as const,
          isActive: true,
        }))
      );
      setLoading(false);
    }
    loadData();
  }, []);

  const filteredMeetings = meetings.filter((m) => {
    const matchesStatus = filterStatus === "all" || m.status === filterStatus;
    const matchesSearch =
      searchQuery === "" ||
      m.employeeName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.managerName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  async function handleCreateMeeting() {
    if (!newMeeting.employeeId || !newMeeting.managerId || !newMeeting.scheduledAt) {
      return;
    }
    
    setCreating(true);
    const result = await createMeeting({
      employeeId: newMeeting.employeeId,
      managerId: newMeeting.managerId,
      scheduledAt: new Date(newMeeting.scheduledAt).toISOString(),
      durationMinutes: parseInt(newMeeting.durationMinutes) || 60,
      location: newMeeting.location || undefined,
      templateName: newMeeting.templateName || undefined,
      sharedAgenda: newMeeting.sharedAgenda || undefined,
    });

    if (result) {
      const updatedMeetings = await getAllMeetings();
      setMeetings(updatedMeetings);
      setDialogOpen(false);
      setNewMeeting({
        employeeId: "",
        managerId: "",
        scheduledAt: "",
        durationMinutes: "60",
        location: "",
        templateName: "Medarbetarsamtal",
        sharedAgenda: "",
      });
    }
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            1:1 Meetings
          </h1>
          <Badge variant="secondary" className="ml-2">
            {meetings.length} total
          </Badge>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-meeting">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Meeting
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Schedule New 1:1 Meeting</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employee">Employee</Label>
                  <Select
                    value={newMeeting.employeeId}
                    onValueChange={(v) => setNewMeeting({ ...newMeeting, employeeId: v })}
                  >
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manager">Manager</Label>
                  <Select
                    value={newMeeting.managerId}
                    onValueChange={(v) => setNewMeeting({ ...newMeeting, managerId: v })}
                  >
                    <SelectTrigger data-testid="select-manager">
                      <SelectValue placeholder="Select manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduledAt">Date & Time</Label>
                  <Input
                    id="scheduledAt"
                    type="datetime-local"
                    value={newMeeting.scheduledAt}
                    onChange={(e) => setNewMeeting({ ...newMeeting, scheduledAt: e.target.value })}
                    data-testid="input-scheduled-at"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={newMeeting.durationMinutes}
                    onChange={(e) => setNewMeeting({ ...newMeeting, durationMinutes: e.target.value })}
                    data-testid="input-duration"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newMeeting.location}
                    onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
                    placeholder="e.g. Conference Room A"
                    data-testid="input-location"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template">Template</Label>
                  <Select
                    value={newMeeting.templateName}
                    onValueChange={(v) => setNewMeeting({ ...newMeeting, templateName: v })}
                  >
                    <SelectTrigger data-testid="select-template">
                      <SelectValue placeholder="Select template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Medarbetarsamtal">Medarbetarsamtal</SelectItem>
                      <SelectItem value="Lönesamtal">Lönesamtal</SelectItem>
                      <SelectItem value="Check-in">Check-in</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="agenda">Shared Agenda</Label>
                <Textarea
                  id="agenda"
                  value={newMeeting.sharedAgenda}
                  onChange={(e) => setNewMeeting({ ...newMeeting, sharedAgenda: e.target.value })}
                  placeholder="Add agenda items for the meeting..."
                  rows={3}
                  data-testid="textarea-agenda"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateMeeting}
                  disabled={!newMeeting.employeeId || !newMeeting.managerId || !newMeeting.scheduledAt || creating}
                  data-testid="button-create-meeting"
                >
                  {creating ? "Creating..." : "Create Meeting"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
          data-testid="input-search"
        />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredMeetings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground" data-testid="text-no-meetings">
              {meetings.length === 0
                ? "No meetings scheduled yet. Click 'Schedule Meeting' to create your first 1:1."
                : "No meetings match your filters."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMeetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={`/app/one-to-ones/${meeting.id}`}
              data-testid={`link-meeting-${meeting.id}`}
            >
              <Card className="hover-elevate cursor-pointer">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{meeting.employeeName || "Unknown"}</span>
                        <span className="text-muted-foreground">with</span>
                        <span className="font-medium">{meeting.managerName || "Unknown"}</span>
                        {meeting.templateName && (
                          <Badge variant="outline" className="ml-2">
                            {meeting.templateName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(meeting.scheduledAt), "PPp")}
                        </div>
                        {meeting.durationMinutes && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {meeting.durationMinutes} min
                          </div>
                        )}
                        {meeting.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-4 w-4" />
                            {meeting.location}
                          </div>
                        )}
                      </div>
                    </div>
                    <Badge className={statusColors[meeting.status]}>
                      {statusLabels[meeting.status]}
                    </Badge>
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
