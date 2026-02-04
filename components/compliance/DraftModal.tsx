"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Loader2, Copy, CopyCheck } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useToast } from "@/hooks/use-toast";

export type DraftModalInput =
  | { actionId: string }
  | {
      employee_id: string;
      compliance_code: string;
      action_type: string;
      due_date?: string | null;
    };

type DraftModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  input: DraftModalInput | null;
  activeSiteId?: string | null;
};

type RenderResponse =
  | { ok: true; title: string; body: string; channel: string; usedTemplateId?: string }
  | { ok: false; step: string; error?: string; message?: string };

function logDraftEvent(
  actionId: string,
  payload: { channel: string | null; template_id: string | null; copied_title: boolean; copied_body: boolean }
) {
  fetch(`/api/compliance/actions/${actionId}/draft-event`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...withDevBearer() },
    body: JSON.stringify(payload),
  }).catch((err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[DraftModal] draft-event log failed:", err);
    }
  });
}

export function DraftModal({
  open,
  onOpenChange,
  input,
}: DraftModalProps) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<"email" | "sms" | "note">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [renderMeta, setRenderMeta] = useState<{ channel: string; usedTemplateId: string | null } | null>(null);
  const [copied, setCopied] = useState<"body" | "both" | null>(null);

  const fetchDraft = useCallback(async () => {
    if (!input || !open) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = { channel };
      if ("actionId" in input) {
        body.actionId = input.actionId;
      } else {
        body.employee_id = input.employee_id;
        body.compliance_code = input.compliance_code;
        body.action_type = input.action_type;
        if (input.due_date != null) body.due_date = input.due_date;
      }
      const res = await fetch("/api/hr/templates/compliance-actions/render", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RenderResponse;
      if (!res.ok) {
        const err = json as Extract<RenderResponse, { ok: false }>;
        if (err.step === "template_missing") {
          toast({
            title: "No template configured for this action type",
            variant: "destructive",
          });
        } else {
          setError(err.error ?? err.message ?? "Failed to generate draft");
          toast({
            title: err.error ?? err.message ?? "Failed to generate draft",
            variant: "destructive",
          });
        }
        return;
      }
      if (json.ok && "title" in json && "body" in json) {
        setResult({ title: json.title, body: json.body });
        setRenderMeta({
          channel: json.channel ?? channel,
          usedTemplateId: json.usedTemplateId ?? null,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate draft";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [input, open, channel, toast]);

  useEffect(() => {
    if (open && input) {
      fetchDraft();
    } else {
      setResult(null);
      setRenderMeta(null);
      setError(null);
    }
  }, [open, input, channel, fetchDraft]);

  const handleCopyBody = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.body);
      setCopied("body");
      toast({ title: "Body copied to clipboard" });
      setTimeout(() => setCopied(null), 1500);
      if (input && "actionId" in input) {
        logDraftEvent(input.actionId, {
          channel: renderMeta?.channel ?? null,
          template_id: renderMeta?.usedTemplateId ?? null,
          copied_title: false,
          copied_body: true,
        });
      }
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [result, toast, input, renderMeta]);

  const handleCopyBoth = useCallback(async () => {
    if (!result) return;
    const text = `Subject: ${result.title}\n\n${result.body}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied("both");
      toast({ title: "Title + body copied" });
      setTimeout(() => setCopied(null), 1500);
      if (input && "actionId" in input) {
        logDraftEvent(input.actionId, {
          channel: renderMeta?.channel ?? null,
          template_id: renderMeta?.usedTemplateId ?? null,
          copied_title: true,
          copied_body: true,
        });
      }
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  }, [result, toast, input, renderMeta]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate draft
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {input && (
            <div className="space-y-2">
              <Label className="text-xs">Channel</Label>
              <Select
                value={channel}
                onValueChange={(v: "email" | "sms" | "note") => setChannel(v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="note">Internal note</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading draft…
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-destructive py-2">{error}</p>
          )}
          {result && !loading && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Subject</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  {result.title}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body</Label>
                <Textarea
                  readOnly
                  value={result.body}
                  rows={10}
                  className="resize-none font-mono text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyBody}
                >
                  {copied === "body" ? (
                    <CopyCheck className="h-4 w-4 mr-2 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy body
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyBoth}
                >
                  {copied === "both" ? (
                    <CopyCheck className="h-4 w-4 mr-2 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy title + body
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
