"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, ArrowLeft, User, ListTodo } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";

type WorkflowStep = {
  id: string;
  code: string;
  name: string;
  order: number;
  defaultDueDays: number | null;
  required: boolean;
  step_type: string | null;
  order_index: number | null;
};

type WorkflowRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  trigger_type: string | null;
  role_scope: string | null;
  is_active: boolean;
  created_at: string | null;
  steps: WorkflowStep[];
};

export default function HrWorkflowEnginePage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategory, setCreateCategory] = useState("onboarding");
  const [createTrigger, setCreateTrigger] = useState("manual");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchJson<WorkflowRow[]>("/api/hr/workflows")
      .then((res) => {
        if (res.ok) setWorkflows(res.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadEmployees = () => {
    fetch("/api/employees", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data.map((e: { id: string; name?: string }) => ({ id: e.id, name: e.name ?? e.id })) : []))
      .catch(() => setEmployees([]));
  };

  const handleCreate = () => {
    if (!createName.trim()) return;
    setCreating(true);
    fetchJson<{ ok: boolean; id: string }>("/api/hr/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: createName.trim(),
        category: createCategory,
        trigger_type: createTrigger,
        is_active: true,
        steps: [],
      }),
    })
      .then((res) => {
        if (res.ok) {
          setCreateOpen(false);
          setCreateName("");
          fetchJson<WorkflowRow[]>("/api/hr/workflows").then((r) => r.ok && setWorkflows(r.data ?? []));
        }
      })
      .finally(() => setCreating(false));
  };

  const handleToggleActive = (wf: WorkflowRow) => {
    fetch(`/api/hr/workflows/${wf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !wf.is_active }),
      credentials: "include",
    }).then(() => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === wf.id ? { ...w, is_active: !w.is_active } : w))
      );
    });
  };

  const openAssign = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    setAssignEmployeeId("");
    loadEmployees();
    setAssignOpen(true);
  };

  const handleAssign = () => {
    if (!selectedWorkflowId || !assignEmployeeId) return;
    setAssigning(true);
    fetch(`/api/hr/workflows/${selectedWorkflowId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: assignEmployeeId }),
      credentials: "include",
    })
      .then((r) => r.json())
      .then(() => {
        setAssignOpen(false);
        setSelectedWorkflowId(null);
      })
      .finally(() => setAssigning(false));
  };

  return (
    <div className="p-6 max-w-4xl" data-testid="hr-workflow-engine-page">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/app/hr" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold">Workflows (Engine v1)</h1>
          <p className="text-sm text-muted-foreground">Create workflows, add steps, activate and assign</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="ml-auto" data-testid="button-create-workflow">
          <Plus className="h-4 w-4 mr-2" />
          Create workflow
        </Button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-20 bg-muted rounded-lg" />
          <div className="h-20 bg-muted rounded-lg" />
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground text-sm">
            No workflows. Create one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <Card key={wf.id} data-testid={`workflow-${wf.id}`}>
              <CardHeader className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{wf.name}</CardTitle>
                    {wf.category && <Badge variant="secondary">{wf.category}</Badge>}
                    {!wf.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openAssign(wf.id)}
                      data-testid={`assign-${wf.id}`}
                    >
                      <User className="h-3 w-3 mr-1" />
                      Assign
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(wf)}
                      data-testid={`toggle-${wf.id}`}
                    >
                      {wf.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <ListTodo className="h-3 w-3" />
                  {wf.steps.length} steps · Trigger: {wf.trigger_type ?? "manual"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Onboarding"
                data-testid="input-workflow-name"
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={createCategory} onValueChange={setCreateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employment">employment</SelectItem>
                  <SelectItem value="onboarding">onboarding</SelectItem>
                  <SelectItem value="compliance">compliance</SelectItem>
                  <SelectItem value="offboarding">offboarding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Trigger</Label>
              <Select value={createTrigger} onValueChange={setCreateTrigger}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">manual</SelectItem>
                  <SelectItem value="on_employee_created">on_employee_created</SelectItem>
                  <SelectItem value="on_role_assigned">on_role_assigned</SelectItem>
                  <SelectItem value="on_contract_end">on_contract_end</SelectItem>
                  <SelectItem value="on_expiry">on_expiry</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim() || creating} data-testid="button-create-confirm">
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign workflow to employee</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Employee</Label>
            <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
              <SelectTrigger data-testid="select-assign-employee">
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={!assignEmployeeId || assigning} data-testid="button-assign-confirm">
              {assigning ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
