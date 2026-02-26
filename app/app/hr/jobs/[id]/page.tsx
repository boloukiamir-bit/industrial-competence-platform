"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, ArrowLeft, Download, Clock, Send, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type JobEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorEmail: string | null;
  note: string | null;
  createdAt: string;
};

type Job = {
  id: string;
  title: string;
  renderedBody: string;
  status: string;
  createdAt: string;
  templateName: string;
  employeeName: string;
  employeeNumber: string;
  events?: JobEvent[];
};

const TERMINAL_STATUSES = ["COMPLETED", "CANCELLED"];

function eventLabel(eventType: string, fromStatus: string | null, toStatus: string | null): string {
  if (eventType === "CREATED") return "Job created";
  if (eventType === "PDF_GENERATED") return "PDF generated";
  if (toStatus) return `${fromStatus ?? "—"} → ${toStatus}`;
  return eventType;
}

export default function JobDetailPage() {
  const params = useParams();
  const { toast } = useToast();
  const id = typeof params?.id === "string" ? params.id : "";
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const fetchJob = useCallback(async (): Promise<Job | null> => {
    if (!id) return null;
    const res = await fetch(`/api/hr/jobs/${id}`, { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg =
        (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string")
          ? (data as { error: string }).error
          : res.status === 404
            ? "Job not found"
            : "Failed to load job";
      throw new Error(msg);
    }
    return data;
  }, [id]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchJob()
      .then((data) => {
        if (!cancelled && data) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast({ title: err instanceof Error ? err.message : "Failed to load job", variant: "destructive" });
          setJob(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, toast, fetchJob]);

  const handleGeneratePdf = async () => {
    if (!id) return;
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/hr/jobs/${id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data.error as string) || "Failed to generate PDF";
        toast({ title: msg, variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hr-job-${id.slice(0, 8)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF downloaded" });
      const data = await fetchJob().catch(() => null);
      if (data) setJob(data);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Failed to generate PDF", variant: "destructive" });
    } finally {
      setPdfLoading(false);
    }
  };

  const transitionStatus = async (toStatus: string, note?: string) => {
    if (!id) return;
    setStatusLoading(toStatus);
    try {
      const res = await fetch(`/api/hr/jobs/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to_status: toStatus, note: note ?? undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (data.error as string) || "Status update failed", variant: "destructive" });
        return;
      }
      toast({ title: `Marked as ${toStatus.toLowerCase()}` });
      setCancelConfirmOpen(false);
      const updated = await fetchJob().catch(() => null);
      if (updated) setJob(updated);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Status update failed", variant: "destructive" });
    } finally {
      setStatusLoading(null);
    }
  };

  const handleCancel = () => {
    transitionStatus("CANCELLED");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <p className="text-muted-foreground">Job not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app/hr/templates">Back to HR Templates</Link>
        </Button>
      </div>
    );
  }

  const dateCreated = job.createdAt
    ? new Date(job.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })
    : "—";
  const status = (job.status ?? "CREATED").toUpperCase();
  const isTerminal = TERMINAL_STATUSES.includes(status);
  const events = job.events ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/app/hr/templates" aria-label="Back to HR Templates">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{job.title}</h1>
              <p className="text-sm text-muted-foreground">
                {job.employeeName}
                {job.employeeNumber ? ` (${job.employeeNumber})` : ""} · {dateCreated}
              </p>
            </div>
            <Badge variant={isTerminal ? "secondary" : "default"} className="shrink-0 capitalize">
              {status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {status === "CREATED" && (
            <Button
              size="sm"
              onClick={() => transitionStatus("SENT")}
              disabled={!!statusLoading}
              data-testid="job-mark-sent"
            >
              {statusLoading === "SENT" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Mark as sent
            </Button>
          )}
          {status === "SENT" && (
            <Button
              size="sm"
              onClick={() => transitionStatus("SIGNED")}
              disabled={!!statusLoading}
              data-testid="job-mark-signed"
            >
              {statusLoading === "SIGNED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Mark as signed
            </Button>
          )}
          {status === "SIGNED" && (
            <Button
              size="sm"
              onClick={() => transitionStatus("COMPLETED")}
              disabled={!!statusLoading}
              data-testid="job-mark-completed"
            >
              {statusLoading === "COMPLETED" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Mark as completed
            </Button>
          )}
          {(status === "CREATED" || status === "SENT") && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setCancelConfirmOpen(true)}
              disabled={!!statusLoading}
              data-testid="job-cancel"
            >
              <XCircle className="h-4 w-4" />
              Cancel job
            </Button>
          )}
          <Button onClick={handleGeneratePdf} disabled={pdfLoading} data-testid="job-generate-pdf">
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Generate PDF
          </Button>
          <Button variant="outline" asChild>
            <Link href="/app/hr/templates">Back to templates</Link>
          </Button>
        </div>
      </header>

      {cancelConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <Card className="mx-4 w-full max-w-sm">
            <CardHeader>
              <CardTitle id="cancel-title">Cancel job?</CardTitle>
              <p className="text-sm text-muted-foreground">This will set the job status to CANCELLED. You can’t undo this.</p>
            </CardHeader>
            <CardContent className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Keep</Button>
              <Button variant="destructive" onClick={handleCancel} disabled={!!statusLoading}>
                {statusLoading === "CANCELLED" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Cancel job
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </CardTitle>
            <p className="text-sm text-muted-foreground">Last 20 events, newest first.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {events.map((e) => (
                <li key={e.id} className="flex flex-col gap-0.5 text-sm border-b border-border pb-2 last:border-0 last:pb-0">
                  <span className="font-medium">
                    {eventLabel(e.eventType, e.fromStatus, e.toStatus)}
                  </span>
                  <span className="text-muted-foreground">
                    {e.createdAt
                      ? new Date(e.createdAt).toLocaleString("en-CA", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                    {e.actorEmail ? ` · ${e.actorEmail}` : ""}
                  </span>
                  {e.note ? <span className="text-muted-foreground italic">{e.note}</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Rendered content
          </CardTitle>
          <p className="text-sm text-muted-foreground">Template: {job.templateName}</p>
        </CardHeader>
        <CardContent>
          <div className="whitespace-pre-wrap text-sm rounded-md border bg-muted/30 p-4 min-h-[120px]">
            {job.renderedBody || "No content."}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
