"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ChevronRight,
  User,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { 
  getWorkflowTemplates, 
  getWorkflowInstances, 
  startWorkflow,
  completeWorkflowStep,
  cancelWorkflow,
  getWorkflowById
} from "@/services/hrWorkflows";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import type { 
  HRWorkflowTemplate, 
  HRWorkflowInstance, 
  HRWorkflowStatus,
  HRWorkflowTemplateId 
} from "@/types/domain";

export default function HRWorkflowsPage() {
  const [templates] = useState<HRWorkflowTemplate[]>(getWorkflowTemplates());
  const [instances, setInstances] = useState<HRWorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [statusFilter, setStatusFilter] = useState<HRWorkflowStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<HRWorkflowTemplateId | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [starting, setStarting] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<HRWorkflowInstance | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const loadInstances = useCallback(async () => {
    const filters: { status?: HRWorkflowStatus } = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    const data = await getWorkflowInstances(filters);
    setInstances(data);
  }, [statusFilter]);

  useEffect(() => {
    async function checkAuthAndLoad() {
      const user = await getCurrentUser();
      if (!user || user.role !== "HR_ADMIN") {
        setAuthorized(false);
        setLoading(false);
        return;
      }
      
      await loadInstances();
      const { data } = await supabase
        .from("employees")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setEmployees(data || []);
      setLoading(false);
    }
    checkAuthAndLoad();
  }, [loadInstances]);

  const filteredInstances = instances.filter((i) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      i.templateName.toLowerCase().includes(term) ||
      i.employeeName?.toLowerCase().includes(term)
    );
  });

  async function handleStartWorkflow() {
    if (!selectedTemplate || !selectedEmployeeId) return;
    setStarting(true);
    await startWorkflow(selectedTemplate, selectedEmployeeId);
    await loadInstances();
    setShowStartDialog(false);
    setSelectedTemplate(null);
    setSelectedEmployeeId("");
    setStarting(false);
  }

  async function handleCompleteStep(stepId: string) {
    if (!selectedInstance) return;
    await completeWorkflowStep(selectedInstance.id, stepId);
    const updated = await getWorkflowById(selectedInstance.id);
    if (updated) setSelectedInstance(updated);
    await loadInstances();
  }

  async function handleCancelWorkflow() {
    if (!selectedInstance) return;
    await cancelWorkflow(selectedInstance.id);
    setShowDetailDialog(false);
    setSelectedInstance(null);
    await loadInstances();
  }

  function openInstanceDetail(instance: HRWorkflowInstance) {
    setSelectedInstance(instance);
    setShowDetailDialog(true);
  }

  const statusBadge = (status: HRWorkflowStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default"><Clock className="h-3 w-3 mr-1" /> Active</Badge>;
      case "completed":
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400">
              This page is only accessible to HR Administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="hr-workflows-page">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">HR Workflows</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage standardized HR processes</p>
        </div>
        <Button onClick={() => setShowStartDialog(true)} data-testid="button-start-workflow">
          <Plus className="h-4 w-4 mr-2" />
          Start Workflow
        </Button>
      </div>

      <Tabs defaultValue="instances" className="space-y-6">
        <TabsList>
          <TabsTrigger value="instances">Active Workflows</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search workflows..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search-workflows"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as HRWorkflowStatus | "all")}>
              <SelectTrigger className="w-40" data-testid="select-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredInstances.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <p className="mb-4">No workflows found</p>
                  <Button variant="outline" onClick={() => setShowStartDialog(true)}>
                    Start a Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredInstances.map((instance) => {
                const completedSteps = instance.steps.filter((s) => s.isCompleted).length;
                const totalSteps = instance.steps.length;
                const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                return (
                  <Card 
                    key={instance.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => openInstanceDetail(instance)}
                    data-testid={`card-workflow-${instance.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="font-medium text-gray-900 dark:text-white">{instance.templateName}</span>
                            {statusBadge(instance.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {instance.employeeName || "Unknown"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Started {new Date(instance.startedAt).toLocaleDateString("sv-SE")}
                            </span>
                            <span>{completedSteps}/{totalSteps} steps ({progress}%)</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} data-testid={`card-template-${template.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <Badge variant="secondary">{template.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{template.description}</p>
                  <p className="text-xs text-gray-400 mb-4">{template.defaultSteps.length} steps</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      setShowStartDialog(true);
                    }}
                  >
                    Start This Workflow
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start New Workflow</DialogTitle>
            <DialogDescription>
              Select a workflow template and employee to begin the process.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Template</label>
              <Select value={selectedTemplate || ""} onValueChange={(v) => setSelectedTemplate(v as HRWorkflowTemplateId)}>
                <SelectTrigger data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Employee</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleStartWorkflow} 
              disabled={!selectedTemplate || !selectedEmployeeId || starting}
              data-testid="button-confirm-start"
            >
              {starting ? "Starting..." : "Start Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          {selectedInstance && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <DialogTitle>{selectedInstance.templateName}</DialogTitle>
                  {statusBadge(selectedInstance.status)}
                </div>
                <DialogDescription>
                  {selectedInstance.employeeName} - Started {new Date(selectedInstance.startedAt).toLocaleDateString("sv-SE")}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 max-h-96 overflow-y-auto">
                <div className="space-y-3">
                  {selectedInstance.steps.map((step, index) => (
                    <div 
                      key={step.id} 
                      className={`p-4 rounded-md border ${
                        step.isCompleted 
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                              Step {index + 1}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {step.responsibleRole.toUpperCase()}
                            </Badge>
                            {step.daysFromStart !== 0 && (
                              <span className="text-xs text-gray-400">
                                Day {step.daysFromStart}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-gray-900 dark:text-white">{step.title}</p>
                          {step.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{step.description}</p>
                          )}
                          {step.isCompleted && step.completedAt && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                              Completed {new Date(step.completedAt).toLocaleDateString("sv-SE")}
                            </p>
                          )}
                        </div>
                        {!step.isCompleted && selectedInstance.status === "active" && (
                          <Button 
                            size="sm" 
                            onClick={() => handleCompleteStep(step.id)}
                            data-testid={`button-complete-step-${step.id}`}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        )}
                        {step.isCompleted && (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                {selectedInstance.status === "active" && (
                  <Button variant="destructive" onClick={handleCancelWorkflow}>
                    Cancel Workflow
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
