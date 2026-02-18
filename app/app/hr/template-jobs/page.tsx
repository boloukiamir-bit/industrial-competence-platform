"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Loader2,
  Download,
  UserPlus,
  CheckCircle2,
  Search,
  Inbox,
} from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";
import {
  renderNotesForCreate,
  EMPTY_PLACEHOLDER_HINT,
} from "@/lib/hr/templateRender";

const DELEGATABLE_CODES = ["MED-001", "CUST-IKEA-001", "SAF-CORE-001"];
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE", "BLOCKED"] as const;

type Template = { code: string; name: string; category: string; content: unknown };
type Job = {
  id: string;
  templateCode: string;
  employeeId: string;
  employeeName: string;
  employeeNumber: string;
  ownerUserId: string | null;
  status: string;
  dueDate: string | null;
  notes: string | null;
  filledValues: Record<string, unknown>;
  createdAt: string;
};
type JobDetail = Job & {
  templateName: string;
  templateCategory: string;
  templateContent: Record<string, unknown>;
  employeeLine: string;
  updatedAt: string;
  createdBy: string;
};
type Employee = { id: string; name: string; employeeNumber: string; line?: string; lineCode?: string };
type Owner = { userId: string; email: string };

function statusVariant(s: string) {
  if (s === "DONE") return "default";
  if (s === "IN_PROGRESS") return "secondary";
  if (s === "BLOCKED") return "destructive";
  return "outline";
}

export default function HrTemplateJobsPage() {
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQ, setSearchQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTemplate, setCreateTemplate] = useState<Template | null>(null);
  const [createEmpSearch, setCreateEmpSearch] = useState("");
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    ownerUserId: "",
    dueDate: "",
    notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [userHasEditedNotes, setUserHasEditedNotes] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/hr/templates", { credentials: "include", headers: withDevBearer() });
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) {
      const flat = data.flatMap((c: { category: string; templates: Template[] }) =>
        c.templates.map((t) => ({ ...t, category: c.category }))
      );
      setTemplates(flat.filter((t: Template) => DELEGATABLE_CODES.includes(t.code)));
    } else setTemplates([]);
  }, []);

  const fetchJobs = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (searchQ) params.set("q", searchQ);
    const res = await fetch(`/api/hr/template-jobs?${params}`, {
      credentials: "include",
      headers: withDevBearer(),
    });
    const json = await res.json().catch(() => ({}));
    setJobs(json.jobs ?? []);
  }, [statusFilter, searchQ]);

  const fetchEmployees = useCallback(async () => {
    const res = await fetch("/api/employees", { credentials: "include", headers: withDevBearer() });
    const json = await res.json().catch(() => ({}));
    setEmployees(json.employees ?? []);
  }, []);

  const fetchOwners = useCallback(async () => {
    const res = await fetch("/api/hr/owners", { credentials: "include", headers: withDevBearer() });
    const json = await res.json().catch(() => ({}));
    setOwners(json.owners ?? []);
  }, []);

  useEffect(() => {
    if (!currentOrg?.id) return;
    setLoading(true);
    Promise.all([fetchTemplates(), fetchJobs(), fetchEmployees(), fetchOwners()]).finally(() =>
      setLoading(false)
    );
  }, [currentOrg?.id, fetchTemplates, fetchJobs, fetchEmployees, fetchOwners]);

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetchJobs();
  }, [currentOrg?.id, fetchJobs]);

  const openCreate = (t: Template) => {
    setCreateTemplate(t);
    setCreateEmpSearch("");
    setUserHasEditedNotes(false);
    setCreateForm({ employeeId: "", ownerUserId: "", dueDate: "", notes: "" });
    setCreateOpen(true);
  };

  // Prefill notes when employee is selected and user has not edited notes.
  useEffect(() => {
    if (!createOpen || !createTemplate) return;
    if (userHasEditedNotes) return;
    const empId = createForm.employeeId;
    const emp = employees.find((e) => e.id === empId);
    const orgName = currentOrg?.name ?? "";
    const siteName = ""; // optional: could come from org context later
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = createForm.dueDate || "";
    if (!empId || !emp) {
      setCreateForm((f) => ({ ...f, notes: EMPTY_PLACEHOLDER_HINT }));
      return;
    }
    const rendered = renderNotesForCreate(
      createTemplate.code,
      createTemplate.content as { default_notes?: string; body?: string } | undefined,
      {
        employee_name: emp.name,
        employee_no: emp.employeeNumber ?? "",
        employee_line: emp.line ?? emp.lineCode ?? "",
        org_name: orgName,
        site_name: siteName,
        today,
        due_date: dueDate,
      }
    );
    setCreateForm((f) => ({ ...f, notes: rendered }));
  }, [
    createOpen,
    createTemplate,
    createForm.employeeId,
    createForm.dueDate,
    userHasEditedNotes,
    employees,
    currentOrg?.name,
  ]);

  const handleCreate = async () => {
    if (!createTemplate) return;
    const empId = createForm.employeeId.trim();
    if (!empId) {
      toast({ title: "Select an employee", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/hr/template-jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify({
          template_code: createTemplate.code,
          employee_id: empId,
          owner_user_id: createForm.ownerUserId || null,
          due_date: createForm.dueDate || null,
          notes: createForm.notes || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json.error ?? "Failed to create job", variant: "destructive" });
        return;
      }
      toast({ title: "Job created" });
      setCreateOpen(false);
      setCreateTemplate(null);
      fetchJobs();
    } finally {
      setCreating(false);
    }
  };

  const openDetail = async (id: string) => {
    setDetailJobId(id);
    setDetailJob(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/hr/template-jobs/${id}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDetailJob(data);
        const vals: Record<string, string> = {};
        for (const [k, v] of Object.entries(data.filledValues ?? {})) {
          vals[k] = String(v ?? "");
        }
        setEditValues(vals);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownloadPdf = async (id: string) => {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/hr/template-jobs/${id}/pdf`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const ct = res.headers.get("Content-Type") || "";
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast({
          title: "Download failed",
          description: json.error ?? res.statusText,
          variant: "destructive",
        });
        return;
      }
      if (!ct.includes("application/pdf")) {
        toast({
          title: "Download failed",
          description: "Server did not return a PDF",
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JOB_${detailJob?.templateCode ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleMarkDone = async () => {
    if (!detailJobId) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/hr/template-jobs/${detailJobId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify({ status: "DONE", filled_values: editValues }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json.error ?? "Update failed", variant: "destructive" });
        return;
      }
      toast({ title: "Marked as done" });
      setDetailJob((prev) => (prev ? { ...prev, status: "DONE", filledValues: editValues } : null));
      fetchJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignOwner = async (ownerUserId: string | null) => {
    if (!detailJobId) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/hr/template-jobs/${detailJobId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify({ owner_user_id: ownerUserId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json.error ?? "Assign failed", variant: "destructive" });
        return;
      }
      toast({ title: "Owner updated" });
      setDetailJob((prev) => (prev ? { ...prev, ownerUserId } : null));
      fetchJobs();
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveFilledValues = async () => {
    if (!detailJobId) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/hr/template-jobs/${detailJobId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        body: JSON.stringify({ filled_values: editValues }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: json.error ?? "Save failed", variant: "destructive" });
        return;
      }
      toast({ title: "Saved" });
      setDetailJob((prev) => (prev ? { ...prev, filledValues: editValues } : null));
    } finally {
      setUpdating(false);
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      !createEmpSearch ||
      e.name.toLowerCase().includes(createEmpSearch.toLowerCase()) ||
      e.employeeNumber.toLowerCase().includes(createEmpSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">HR Templates</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Delegatable jobs with downloadable PDF. Create a job, assign an owner, track to done.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Templates</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <Card
                key={t.code}
                className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
                onClick={() => openCreate(t)}
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <Badge variant="secondary" className="w-fit text-xs">
                    {t.category}
                  </Badge>
                  <CardTitle className="text-base mt-2">{t.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground">
                    {(t.content as { description?: string })?.description ?? t.code}
                  </p>
                  <Button size="sm" className="mt-3 w-full" variant="outline">
                    <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                    Create Job
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Jobs Inbox
          </h2>
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="w-full sm:w-40"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {jobs.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No jobs yet. Click a template to create one.
                </CardContent>
              </Card>
            ) : (
              jobs.map((j) => (
                <Card
                  key={j.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => openDetail(j.id)}
                >
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{j.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{j.templateCode}</p>
                      </div>
                      <Badge variant={statusVariant(j.status)}>{j.status.replace("_", " ")}</Badge>
                    </div>
                    {j.dueDate && (
                      <p className="text-xs text-muted-foreground mt-1">Due: {j.dueDate}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Create Job drawer */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              Create Job {createTemplate ? `— ${createTemplate.name}` : ""}
            </SheetTitle>
          </SheetHeader>
          {createTemplate && (
            <div className="mt-6 space-y-4">
              <div>
                <Label>Employee</Label>
                <div className="mt-1 space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or number..."
                      value={createEmpSearch}
                      onChange={(e) => setCreateEmpSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                    {filteredEmployees.slice(0, 20).map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => {
                          setCreateForm((f) => ({ ...f, employeeId: e.id }));
                          setCreateEmpSearch("");
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted/50 ${
                          createForm.employeeId === e.id ? "bg-muted" : ""
                        }`}
                      >
                        {e.name} {e.employeeNumber && `(${e.employeeNumber})`}
                      </button>
                    ))}
                  </div>
                  {createForm.employeeId && (
                    <p className="text-xs text-muted-foreground">
                      Selected: {employees.find((x) => x.id === createForm.employeeId)?.name}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Owner</Label>
                <Select
                  value={createForm.ownerUserId || "__me__"}
                  onValueChange={(v) => setCreateForm((f) => ({ ...f, ownerUserId: v === "__me__" ? "" : v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Current user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__me__">Current user</SelectItem>
                    {owners.map((o) => (
                      <SelectItem key={o.userId} value={o.userId}>
                        {o.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={createForm.notes}
                  onChange={(e) => {
                    setUserHasEditedNotes(true);
                    setCreateForm((f) => ({ ...f, notes: e.target.value }));
                  }}
                  rows={3}
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                  Create Job
                </Button>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Job detail drawer */}
      <Sheet open={!!detailJobId} onOpenChange={(o) => !o && setDetailJobId(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Job details</SheetTitle>
          </SheetHeader>
          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : detailJob ? (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <Badge variant={statusVariant(detailJob.status)}>{detailJob.status}</Badge>
                <span className="text-sm text-muted-foreground">{detailJob.templateCode}</span>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="font-medium">{detailJob.templateName}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {detailJob.employeeName} • {detailJob.employeeNumber}
                  {detailJob.employeeLine && ` • ${detailJob.employeeLine}`}
                </p>
                {detailJob.notes && (
                  <p className="text-sm mt-2 text-muted-foreground">{detailJob.notes}</p>
                )}
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Editable fields</h3>
                <div className="space-y-2">
                  {Object.keys(
                    (detailJob.templateContent as { sections?: Array<{ fields?: string[] }> })?.sections?.flatMap(
                      (s) => s.fields ?? []
                    ) ?? []
                  )
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .map((k) => (
                      <div key={k}>
                        <Label className="text-xs">{k}</Label>
                        <Input
                          value={editValues[k] ?? ""}
                          onChange={(e) => setEditValues((v) => ({ ...v, [k]: e.target.value }))}
                          className="mt-0.5"
                        />
                      </div>
                    ))}
                </div>
              </div>

              {/* PDF Preview: same content as PDF */}
              <div className="rounded-lg border bg-muted/20 p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">PDF Preview</h3>
                <div className="text-sm space-y-2">
                  <p className="font-medium">{detailJob.templateName}</p>
                  <p className="text-xs text-muted-foreground">{detailJob.templateCode} • {detailJob.status}</p>
                  <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                    <span className="text-muted-foreground">Employee:</span>
                    <span>{detailJob.employeeName} ({detailJob.employeeNumber}){detailJob.employeeLine ? ` • ${detailJob.employeeLine}` : ""}</span>
                    <span className="text-muted-foreground">Due:</span>
                    <span>{detailJob.dueDate ?? "—"}</span>
                    <span className="text-muted-foreground">Owner:</span>
                    <span>{detailJob.ownerUserId ? owners.find((o) => o.userId === detailJob.ownerUserId)?.email ?? "—" : "—"}</span>
                    <span className="text-muted-foreground">Created:</span>
                    <span>{detailJob.createdAt ? new Date(detailJob.createdAt).toISOString().slice(0, 10) : "—"}</span>
                  </div>
                  {detailJob.notes && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                      <p className="whitespace-pre-wrap">{detailJob.notes}</p>
                    </div>
                  )}
                  {Object.keys(editValues).length > 0 && (
                    <div className="pt-2 border-t mt-2">
                      <p className="text-xs text-muted-foreground mb-1">Editable fields</p>
                      <div className="space-y-0.5">
                        {Object.entries(editValues).map(([k, v]) => (
                          <div key={k} className="grid grid-cols-[100px_1fr] gap-2 text-xs">
                            <span className="text-muted-foreground">{k}:</span>
                            <span>{v || "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 bg-background pt-4 border-t space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPdf(detailJob.id)}
                    disabled={downloadingPdf}
                  >
                    {downloadingPdf ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                    Download PDF
                  </Button>
                  <Select
                    value={detailJob.ownerUserId ?? "__none__"}
                    onValueChange={(v) => handleAssignOwner(v === "__none__" ? null : v)}
                    disabled={updating}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Assign owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.userId} value={o.userId}>
                          {o.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {detailJob.status !== "DONE" && (
                    <Button size="sm" onClick={handleMarkDone} disabled={updating}>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Mark Done
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={handleSaveFilledValues} disabled={updating}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
