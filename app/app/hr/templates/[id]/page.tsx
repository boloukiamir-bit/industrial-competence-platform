"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

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

export default function HrTemplateDetailPage() {
  const params = useParams();
  const id = (params.id as string) || "";
  const [workflow, setWorkflow] = useState<HRWorkflow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch("/api/hr/workflows", { credentials: "include" })
      .then((res) => res.json())
      .then((data: HRWorkflow[]) => {
        if (cancelled || !Array.isArray(data)) return;
        const wf = data.find((w) => w.code === id);
        setWorkflow(wf ?? null);
      })
      .catch(() => setWorkflow(null))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/hr/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to HR Workflows
          </Link>
        </Button>
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Workflow not found. <Link href="/app/hr/templates" className="underline">Return to HR Workflows</Link> or <Link href="/app/hr" className="underline">Go to HR Inbox</Link>.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/hr/templates" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{workflow.name}</h1>
          <p className="text-muted-foreground">{workflow.description ?? workflow.code}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Steps ({workflow.steps?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {workflow.steps?.length ? (
            <ol className="space-y-3">
              {workflow.steps
                .sort((a, b) => a.order - b.order)
                .map((step) => (
                  <li key={step.code} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                      {step.order}
                    </span>
                    <div>
                      <p className="font-medium">{step.name}</p>
                      <p className="text-xs text-muted-foreground">{step.code}</p>
                      {step.defaultDueDays != null && (
                        <p className="text-xs text-muted-foreground">Due: {step.defaultDueDays} days</p>
                      )}
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
        <Button asChild>
          <Link href="/app/hr">Open HR Inbox</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/app/hr/templates">Back to HR Workflows</Link>
        </Button>
      </div>
    </div>
  );
}
