"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cog, Plus, Trash2, User, Clock, Save } from "lucide-react";
import type { MachineWithData, PLEmployee, PLAttendance, ShiftType } from "@/types/lineOverview";
import { createAssignment, deleteAssignment, updateAssignment } from "@/services/lineOverview";
import { useToast } from "@/hooks/use-toast";

interface AssignmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  machine: MachineWithData | null;
  planDate: string;
  shiftType: ShiftType;
  employees: PLEmployee[];
  attendance: PLAttendance[];
  onAssignmentChange: () => void;
}

const shiftTimes: Record<ShiftType, { start: string; end: string }> = {
  Day: { start: "07:00", end: "16:00" },
  Evening: { start: "14:00", end: "23:00" },
  Night: { start: "23:00", end: "07:00" },
};

export function AssignmentDrawer({
  open,
  onOpenChange,
  machine,
  planDate,
  shiftType,
  employees,
  attendance,
  onAssignmentChange,
}: AssignmentDrawerProps) {
  const { toast } = useToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState("");
  const [newStartTime, setNewStartTime] = useState(shiftTimes[shiftType].start);
  const [newEndTime, setNewEndTime] = useState(shiftTimes[shiftType].end);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewStartTime(shiftTimes[shiftType].start);
      setNewEndTime(shiftTimes[shiftType].end);
      setNewEmployee("");
      setShowNewForm(false);
    }
  }, [open, shiftType]);

  if (!machine) return null;

  const presentEmployees = attendance
    .filter((a) => a.status === "present" || a.status === "partial")
    .map((a) => {
      const emp = employees.find((e) => e.employeeCode === a.employeeCode);
      return {
        code: a.employeeCode,
        name: emp?.fullName || a.employeeCode,
        status: a.status,
        availableFrom: a.availableFrom,
        availableTo: a.availableTo,
      };
    });

  const handleCreate = async () => {
    if (!newEmployee) {
      toast({ title: "Please select an employee", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const result = await createAssignment(
        planDate,
        shiftType,
        machine.machine.machineCode,
        newEmployee,
        newStartTime,
        newEndTime
      );

      if (result) {
        toast({ title: "Assignment created" });
        onAssignmentChange();
        setShowNewForm(false);
        setNewEmployee("");
      } else {
        toast({ title: "Failed to create assignment", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error creating assignment", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assignmentId: string) => {
    setDeleting(assignmentId);
    try {
      const success = await deleteAssignment(assignmentId);
      if (success) {
        toast({ title: "Assignment deleted" });
        onAssignmentChange();
      } else {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error deleting", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Cog className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle>{machine.machine.machineName}</SheetTitle>
              <SheetDescription>
                {machine.machine.machineCode} • {planDate} • {shiftType} Shift
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{machine.requiredHours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Required Hours</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{machine.assignedHours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">Assigned Hours</p>
            </div>
            <div className="text-center">
              <p
                className={`text-2xl font-bold ${
                  machine.gap > 0 ? "text-destructive" : "text-green-600"
                }`}
              >
                {machine.gap > 0 ? `+${machine.gap.toFixed(1)}` : machine.gap.toFixed(1)}
              </p>
              <p className="text-xs text-muted-foreground">Gap</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Current Assignments</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowNewForm(!showNewForm)}
                data-testid="button-new-assignment"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>

            {machine.assignments.length === 0 && !showNewForm ? (
              <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-lg">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No assignments yet</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  onClick={() => setShowNewForm(true)}
                >
                  Create first assignment
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {machine.assignments.map((assignment) => {
                  const emp = employees.find((e) => e.employeeCode === assignment.employeeCode);
                  return (
                    <div
                      key={assignment.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {emp?.fullName || assignment.employeeCode}
                          </p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {assignment.startTime.slice(0, 5)} – {assignment.endTime.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(assignment.id)}
                        disabled={deleting === assignment.id}
                        data-testid={`button-delete-assignment-${assignment.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {showNewForm && (
              <div className="mt-4 p-4 border rounded-lg space-y-4">
                <h4 className="font-medium text-sm">New Assignment</h4>

                <div className="space-y-2">
                  <Label>Employee</Label>
                  <Select value={newEmployee} onValueChange={setNewEmployee}>
                    <SelectTrigger data-testid="select-employee">
                      <SelectValue placeholder="Select employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presentEmployees.map((emp) => (
                        <SelectItem key={emp.code} value={emp.code}>
                          <div className="flex items-center gap-2">
                            <span>{emp.name}</span>
                            <Badge
                              variant="secondary"
                              className={`text-xs ${
                                emp.status === "partial"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              {emp.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      data-testid="input-start-time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      data-testid="input-end-time"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={handleCreate}
                    disabled={saving}
                    data-testid="button-save-assignment"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Saving..." : "Save Assignment"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowNewForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold mb-3">Available Employees</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {presentEmployees.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No employees available for this shift
                </div>
              ) : (
                presentEmployees.map((emp) => (
                  <div
                    key={emp.code}
                    className="flex items-center justify-between p-2 hover:bg-muted/50 rounded cursor-pointer"
                    onClick={() => {
                      setNewEmployee(emp.code);
                      setShowNewForm(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{emp.name}</span>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`text-xs ${
                        emp.status === "partial"
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                          : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      }`}
                    >
                      {emp.status === "partial"
                        ? `${emp.availableFrom?.slice(0, 5)}–${emp.availableTo?.slice(0, 5)}`
                        : "Full"}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
