"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Workflow, FileText } from "lucide-react";

const isPilotMode = process.env.NEXT_PUBLIC_PILOT_MODE === "true";

/**
 * Pilot-mode guard for legacy /app/workflows/* (wf_* schema with step_no).
 * In pilot we use /app/hr/* (hr_workflows, hr_workflow_steps with step_order).
 * When pilot is on: show friendly card and do not render children (no legacy DB calls).
 */
export default function WorkflowsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isPilotMode) {
      router.replace("/app/hr");
    }
  }, [router]);

  if (isPilotMode) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="max-w-md border-muted">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col items-center gap-4 text-center">
              <Workflow className="h-12 w-12 text-muted-foreground" />
              <div className="space-y-1">
                <h2 className="text-lg font-semibold">Pilot mode: use HR Workflows</h2>
                <p className="text-sm text-muted-foreground">
                  This page uses the legacy workflow system. In pilot mode, use HR Templates and HR Tasks instead.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <Button asChild>
                  <Link href="/app/hr" className="inline-flex items-center gap-2">
                    HR overview
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/app/hr/templates" className="inline-flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    HR Templates
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Redirecting to HR…
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
