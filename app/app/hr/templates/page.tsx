"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, ClipboardList, Sparkles, Pencil } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";

type HRWorkflow = {
  code: string;
  name: string;
  description: string | null;
  steps: Array<{
    code: string;
    name: string;
    order: number;
    defaultDueDays: number | null;
    required: boolean;
  }>;
};

export default function HrTemplatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrg } = useOrg();
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<HRWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillKeyFromUrl = searchParams.get("prefillKey")?.trim() || null;

  type PrefillEntry = { employeeId: string; template: string | null; notes: string; prefillKey: string | null };
  const [prefillFromStorage, setPrefillFromStorage] = useState<PrefillEntry | null>(null);

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
      // ignore
    }
  }, [prefillKeyFromUrl]);

  const prefillParams = prefillFromStorage ?? legacyPrefill;

  const fetchWorkflows = useMemo(
    () => async () => {
      if (!currentOrg?.id) return;
      try {
        const res = await fetch("/api/hr/workflows", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setWorkflows([]);
          setError(Array.isArray(data) ? null : (data.error as string) || "Failed to load workflows");
          return;
        }
        setWorkflows(Array.isArray(data) ? data : []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workflows");
        setWorkflows([]);
      } finally {
        setLoading(false);
      }
    },
    [currentOrg?.id]
  );

  useEffect(() => {
    if (!currentOrg?.id) return;
    fetchWorkflows();
  }, [currentOrg?.id, fetchWorkflows]);

  const handleSeedHrWorkflows = async () => {
    setProvisioning(true);
    try {
      const [onRes, offRes] = await Promise.all([
        fetch("/api/hr/workflows/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workflow_code: "ONBOARDING" }),
        }),
        fetch("/api/hr/workflows/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ workflow_code: "OFFBOARDING" }),
        }),
      ]);
      const onData = await onRes.json().catch(() => ({}));
      const offData = await offRes.json().catch(() => ({}));
      if (!onRes.ok) {
        toast({ title: (onData.error as string) ?? "Onboarding provision failed", variant: "destructive" });
        return;
      }
      if (!offRes.ok) {
        toast({ title: (offData.error as string) ?? "Offboarding provision failed", variant: "destructive" });
        return;
      }
      const onExpected = (onData.stepsExpected as number) ?? 0;
      const offExpected = (offData.stepsExpected as number) ?? 0;
      toast({
        title: "HR workflow steps provisioned",
        description: `Onboarding: ${onData.employeesProcessed ?? 0} employees, ${onExpected} steps. Offboarding: ${offData.employeesProcessed ?? 0} employees, ${offExpected} steps.`,
      });
      await fetchWorkflows();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Provision failed", variant: "destructive" });
    } finally {
      setProvisioning(false);
    }
  };

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
          <h1 className="text-xl font-semibold tracking-tight">HR Workflows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Checklists and workflows: Onboarding, Offboarding, Medical, Contract
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/hr/templates/action-packs">Action packs</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/app/hr">Go to HR Inbox</Link>
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
              From compliance: employee {prefillParams.employeeId}. Go to HR Inbox to manage steps.
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
              <Button size="sm" onClick={() => router.push("/app/hr")}>
                Go to HR Inbox
              </Button>
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

      {workflows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="pt-8 pb-8 px-6">
            <div className="max-w-md mx-auto text-center space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-medium text-base">Pilot start: Seed HR templates + workflows</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Provisions pending onboarding and offboarding steps for all active employees. HR workflows are seeded by migration; this fills step status rows so the HR Inbox shows data.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={handleSeedHrWorkflows} disabled={provisioning}>
                  {provisioning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Seed HR templates + workflows
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Workflows</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <Card
                key={wf.code}
                className="group hover:border-muted-foreground/20 transition-colors"
              >
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {wf.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{wf.steps?.length ?? 0} steps</span>
                  </div>
                  <CardTitle className="text-base mt-2">{wf.name}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {wf.description || "No description"}
                  </p>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <Link href={`/app/hr/templates/${wf.code}`}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      View steps
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={handleSeedHrWorkflows} disabled={provisioning}>
              {provisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
              Seed HR templates + workflows
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
