"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";

type Step = {
  step_order: number;
  step_title: string;
  step_note: string;
};

type TemplateDetail = {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: Step[];
};

const CATEGORY_LABELS: Record<string, string> = {
  license: "License",
  medical: "Medical",
  contract: "Contract",
};

export default function ActionPackDetailPage() {
  const params = useParams();
  const id = (params.id as string) || "";
  const { isAdminOrHr } = useOrg();
  const { toast } = useToast();
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`/api/hr/templates/action-packs/${id}`, { credentials: "include" })
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return;
        if (body.error) {
          setTemplate(null);
          return;
        }
        setTemplate(body);
      })
      .catch(() => setTemplate(null))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleExport = async () => {
    if (!template) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/hr/templates/action-packs/${template.id}/export`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) {
          toast({ title: "Admin/HR only", description: "Export is restricted to admin or HR.", variant: "destructive" });
          return;
        }
        toast({ title: body.error ?? "Export failed", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `action-pack-${template.id}.csv`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported", description: filename });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/hr/templates/action-packs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to action packs
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Template not found.{" "}
            <Link href="/app/hr/templates/action-packs" className="underline">
              Return to action packs
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/hr/templates/action-packs" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate">{template.name}</h1>
          <p className="text-sm text-muted-foreground">
            {CATEGORY_LABELS[template.category] ?? template.category}
            {template.description && ` · ${template.description}`}
          </p>
        </div>
        {isAdminOrHr && (
          <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
            Export CSV
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Checklist ({template.steps.length} steps)</CardTitle>
        </CardHeader>
        <CardContent>
          {template.steps.length > 0 ? (
            <ol className="space-y-3">
              {template.steps.map((step) => (
                <li key={step.step_order} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {step.step_order}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium">{step.step_title || "—"}</p>
                    {step.step_note ? (
                      <p className="text-sm text-muted-foreground mt-0.5">{step.step_note}</p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-muted-foreground">No steps defined.</p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/hr/templates/action-packs">Back to action packs</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/app/hr/templates">HR Templates</Link>
        </Button>
      </div>
    </div>
  );
}
