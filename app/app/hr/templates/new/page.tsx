"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, FileText, ArrowLeft } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";

type TemplateItem = { id: string; code: string; name: string; content: unknown };
type EmployeeItem = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  employeeNumber?: string;
  lineCode?: string;
  team?: string;
};

function getTemplateBody(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && "body" in content && typeof (content as { body: unknown }).body === "string") {
    return (content as { body: string }).body;
  }
  return "";
}

function getTemplateTitle(content: unknown, name: string): string {
  if (content && typeof content === "object" && "title" in content && typeof (content as { title: unknown }).title === "string") {
    return (content as { title: string }).title;
  }
  return name;
}

function replacePlaceholders(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

export default function CreateJobPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [templatesByCategory, setTemplatesByCategory] = useState<{ category: string; templates: TemplateItem[] }[]>([]);
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [renderedBody, setRenderedBody] = useState("");

  const flatTemplates = templatesByCategory.flatMap((c) => c.templates);
  const selectedTemplate = flatTemplates.find((t) => t.id === templateId);
  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const updatePrefill = useCallback(() => {
    if (!selectedTemplate || !selectedEmployee) {
      setRenderedBody("");
      setTitle("");
      return;
    }
    const bodySrc = getTemplateBody(selectedTemplate.content);
    const titleSrc = getTemplateTitle(selectedTemplate.content, selectedTemplate.name);
    const firstName = selectedEmployee.firstName ?? "";
    const lastName = selectedEmployee.lastName ?? "";
    const name = selectedEmployee.name || [firstName, lastName].filter(Boolean).join(" ") || "—";
    const orgUnit = selectedEmployee.team || selectedEmployee.lineCode || "—";
    const vars: Record<string, string> = {
      first_name: firstName,
      last_name: lastName,
      name,
      employee_number: selectedEmployee.employeeNumber ?? "",
      org_unit: orgUnit,
    };
    setRenderedBody(replacePlaceholders(bodySrc, vars));
    setTitle(replacePlaceholders(titleSrc, vars) || selectedTemplate.name);
  }, [selectedTemplate, selectedEmployee]);

  useEffect(() => {
    if (!selectedTemplate || !selectedEmployee) {
      setRenderedBody("");
      setTitle("");
      return;
    }
    updatePrefill();
  }, [selectedTemplate, selectedEmployee, updatePrefill]);

  useEffect(() => {
    if (!currentOrg?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [tRes, eRes] = await Promise.all([
          fetch("/api/hr/templates", { credentials: "include" }),
          fetch("/api/employees", { credentials: "include" }),
        ]);
        const tData = await tRes.json().catch(() => ({}));
        const eData = await eRes.json().catch(() => ({}));
        if (cancelled) return;
        if (!tRes.ok) {
          const msg = (tData && typeof tData === "object" && "error" in tData && typeof (tData as { error: unknown }).error === "string")
            ? (tData as { error: string }).error
            : "Failed to load templates";
          toast({ title: msg, variant: "destructive" });
          setTemplatesByCategory([]);
        } else if (Array.isArray(tData)) {
          setTemplatesByCategory(tData);
        } else {
          setTemplatesByCategory([]);
        }
        if (!eRes.ok) {
          const msg = (eData && typeof eData === "object" && "error" in eData && typeof (eData as { error: unknown }).error === "string")
            ? (eData as { error: string }).error
            : "Failed to load employees";
          toast({ title: msg, variant: "destructive" });
          setEmployees([]);
        } else {
          const list = eData?.employees ?? [];
          setEmployees(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (!cancelled) {
          setTemplatesByCategory([]);
          setEmployees([]);
          toast({ title: err instanceof Error ? err.message : "Failed to load data", variant: "destructive" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrg?.id, toast]);

  const handleSave = async () => {
    if (!templateId || !employeeId) {
      toast({ title: "Select a template and an employee", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/hr/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          template_id: templateId,
          employee_id: employeeId,
          title: title || "HR Job",
          rendered_body: renderedBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (data.error as string) || "Failed to create job", variant: "destructive" });
        return;
      }
      toast({ title: "Job created" });
      router.push(`/app/hr/jobs/${data.id}`);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to create job", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/hr/templates" aria-label="Back to HR Templates">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Create Job</h1>
          <p className="text-sm text-muted-foreground">Select a template and employee to generate a job document.</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template &amp; Employee
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>Template (required)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              data-testid="create-job-template"
            >
              <option value="">Select template</option>
              {flatTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label>Employee (required)</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              data-testid="create-job-employee"
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name || [e.firstName, e.lastName].filter(Boolean).join(" ")} {e.employeeNumber ? `(${e.employeeNumber})` : ""}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {selectedTemplate && selectedEmployee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prefilled content</CardTitle>
            <p className="text-sm text-muted-foreground">Review and edit before saving.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>Title</Label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Body</Label>
              <Textarea
                className="min-h-[200px] resize-y"
                value={renderedBody}
                onChange={(e) => setRenderedBody(e.target.value)}
                data-testid="create-job-body"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} data-testid="create-job-save">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save job
              </Button>
              <Button variant="outline" asChild>
                <Link href="/app/hr/templates">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!selectedTemplate || !selectedEmployee ? (
        <p className="text-sm text-muted-foreground">Select both a template and an employee to see prefilled content.</p>
      ) : null}
    </div>
  );
}
