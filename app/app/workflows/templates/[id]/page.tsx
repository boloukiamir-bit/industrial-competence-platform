"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Play, Clock, User, CheckCircle, Loader2, Search } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";

type TemplateStep = {
  id: string;
  step_no: number;
  title: string;
  description: string;
  owner_role: string;
  default_due_days: number;
  required: boolean;
};

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: TemplateStep[];
};

type Employee = {
  id: string;
  name: string;
};

export default function TemplateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { currentOrg } = useOrg();
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [starting, setStarting] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");

  useEffect(() => {
    if (!currentOrg?.id || !params.id) return;

    async function fetchData() {
      try {
        const [templateRes, employeesRes] = await Promise.all([
          fetch(`/api/workflows/templates/${params.id}`, {
            headers: { "x-org-id": currentOrg!.id },
          }),
          fetch(`/api/employees?org_id=${currentOrg!.id}`),
        ]);

        if (!templateRes.ok) throw new Error("Failed to fetch template");
        const templateData = await templateRes.json();
        setTemplate(templateData);

        if (employeesRes.ok) {
          const employeesData = await employeesRes.json();
          setEmployees(employeesData.employees || employeesData || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load template");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [currentOrg?.id, params.id]);

  const handleEmployeeSelect = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (emp) {
      setSelectedEmployee(emp);
    }
  };

  const filteredEmployees = employees.filter((emp) =>
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const handleStartWorkflow = async () => {
    if (!selectedEmployee || !template) return;

    setStarting(true);
    try {
      const res = await fetch("/api/workflows/instances", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-org-id": currentOrg!.id,
        },
        body: JSON.stringify({
          templateId: template.id,
          employeeId: selectedEmployee.id,
          employeeName: selectedEmployee.name,
        }),
      });

      if (!res.ok) throw new Error("Failed to start workflow");

      const data = await res.json();
      router.push(`/app/workflows/instances/${data.instance.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workflow");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error || "Template not found"}</p>
            <Button className="mt-4" onClick={() => router.push("/app/workflows/templates")}>
              Back to Templates
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
          onClick={() => router.push("/app/workflows/templates")}
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold" data-testid="heading-template-name">
              {template.name}
            </h1>
            <Badge>{template.category}</Badge>
          </div>
          <p className="text-muted-foreground">{template.description}</p>
        </div>
        <Button onClick={() => setShowStartDialog(true)} data-testid="button-start-workflow">
          <Play className="mr-2 h-4 w-4" />
          Start Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps ({template.steps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {template.steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-start gap-4 p-4 border rounded-lg"
                data-testid={`step-${step.step_no}`}
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  {step.step_no}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{step.title}</h3>
                    {step.required && (
                      <Badge variant="outline" className="text-xs">Required</Badge>
                    )}
                  </div>
                  {step.description && (
                    <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {step.owner_role}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due in {step.default_due_days} days
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Workflow: {template.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Employee</Label>
              {employees.length > 5 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search employees..."
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-employee-search"
                  />
                </div>
              )}
              <Select
                value={selectedEmployee?.id || ""}
                onValueChange={handleEmployeeSelect}
              >
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Choose an employee..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No employees found
                    </div>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {selectedEmployee && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedEmployee.name}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStartWorkflow}
              disabled={!selectedEmployee || starting}
              data-testid="button-confirm-start"
            >
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Start Workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
