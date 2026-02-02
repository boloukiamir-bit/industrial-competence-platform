"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Loader2, ClipboardList, Sparkles, Pencil } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { withDevBearer } from "@/lib/devBearer";
import { useToast } from "@/hooks/use-toast";

const HR_CATEGORIES = ["Onboarding", "Offboarding", "Medical", "Contract", "HR"];

type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  is_active: boolean;
  stepCount: number;
};

export default function HrTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillKeyFromUrl = searchParams.get("prefillKey")?.trim() || null;

  const legacyPrefill = useMemo(() => {
    const employeeId = searchParams.get("employeeId")?.trim() || null;
    const template = searchParams.get("template")?.trim() || null;
    const raw = searchParams.get("prefillNotes");
    let notes = "";
    if (raw != null) {
      try {
        notes = decodeURIComponent(raw);
      } catch {
        notes = raw;
      }
    }
    return employeeId && (template || notes) ? { employeeId, template, notes, prefillKey: null as string | null } : null;
  }, [searchParams]);

  type PrefillEntry = { employeeId: string; template: string | null; notes: string; prefillKey: string | null };
  const [prefillFromStorage, setPrefillFromStorage] = useState<PrefillEntry | null>(null);

  useEffect(() => {
    if (!prefillKeyFromUrl) return;
    try {
      const raw = sessionStorage.getItem(prefillKeyFromUrl);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && "employeeId" in parsed && typeof (parsed as { employeeId: unknown }).employeeId === "string") {
        const p = parsed as { employeeId: string; templateId?: string | null; notes?: string };
        setPrefillFromStorage({
          employeeId: p.employeeId,
          template: p.templateId ?? null,
          notes: typeof p.notes === "string" ? p.notes : "",
          prefillKey: prefillKeyFromUrl,
        });
      }
    } catch {
      // invalid or missing
    }
  }, [prefillKeyFromUrl]);

  const prefillParams = prefillFromStorage ?? legacyPrefill;

  const fetchTemplates = useMemo(
    () => async () => {
      if (!currentOrg?.id) return;
      try {
        const res = await fetch("/api/workflows/templates", {
          credentials: "include",
          headers: withDevBearer(),
        });
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.templates) ? data.templates : [];
        setTemplates(list);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load templates");
      } finally {
        setLoading(false);
      }
    },
    [currentOrg?.id]
  );

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetchTemplates();
  }, [currentOrg?.id, fetchTemplates]);

  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/workflows/templates/seed-defaults", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (data as { error?: string }).error ?? "Failed to create templates", variant: "destructive" });
        return;
      }
      const created = (data as { created?: number }).created ?? 0;
      toast({ title: `${created} templates created` });
      await fetchTemplates();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const hrTemplates = templates.filter((t) =>
    HR_CATEGORIES.some((c) => c.toLowerCase() === (t.category || "").toLowerCase())
  );
  const displayTemplates = hrTemplates.length > 0 ? hrTemplates : templates;

  const templateIdForPrefill =
    prefillParams?.template && displayTemplates.some((t) => t.id === prefillParams.template)
      ? prefillParams.template
      : displayTemplates[0]?.id;
  const templateNameForPrefill = displayTemplates.find((t) => t.id === templateIdForPrefill)?.name ?? "template";

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">HR Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Checklists and workflows: Onboarding, Offboarding, Medical, Contract
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/workflows/templates">All Workflow Templates</Link>
          </Button>
          <Button size="sm" onClick={() => router.push("/app/workflows/templates/new")}>
            <Plus className="mr-1.5 h-4 w-4" />
            Create Template
          </Button>
        </div>
      </header>

      {prefillParams && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Create HR task
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              From compliance: employee {prefillParams.employeeId}. Choose template and open to create instance.
            </p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Notes (prefilled)</Label>
              <Textarea
                value={prefillParams.notes}
                readOnly
                rows={2}
                className="resize-none bg-muted/50 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {templateIdForPrefill && (
                <Button
                  size="sm"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("employeeId", prefillParams.employeeId);
                    params.set("prefillNotes", encodeURIComponent(prefillParams.notes));
                    router.push(`/app/workflows/templates/${templateIdForPrefill}?${params.toString()}`);
                  }}
                >
                  Open {templateNameForPrefill} & create instance
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (prefillParams.prefillKey) {
                    try {
                      sessionStorage.removeItem(prefillParams.prefillKey);
                    } catch {
                      // ignore
                    }
                  }
                  router.push("/app/hr/templates");
                }}
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {displayTemplates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-medium text-base">Pilot start: Create recommended HR templates</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Creates 4 templates (Onboarding, Offboarding, Medical, Contract) you can edit later.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={handleSeedDefaults} disabled={seeding}>
                  {seeding ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Create 4 templates
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/app/workflows/templates/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create manually
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Templates</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {displayTemplates.map((template) => (
              <Card
                key={template.id}
                className="group hover:border-muted-foreground/20 transition-colors"
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {template.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{template.stepCount} steps</span>
                  </div>
                  <CardTitle className="text-base mt-2">{template.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {template.description || "No description"}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/app/hr/templates/${template.id}`}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      Edit / Create instance
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
