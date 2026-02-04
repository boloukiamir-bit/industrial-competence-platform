"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link2, Loader2, Copy, CopyCheck } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useToast } from "@/hooks/use-toast";

export type ExistingEvidence = {
  evidence_url: string;
  evidence_notes?: string | null;
  evidence_added_at?: string | null;
};

type EvidenceModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actionId: string | null;
  existingEvidence?: ExistingEvidence | null;
  onSaved: () => void;
};

export function EvidenceModal({
  open,
  onOpenChange,
  actionId,
  existingEvidence,
  onSaved,
}: EvidenceModalProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(existingEvidence?.evidence_url?.trim() ?? "");
      setNotes(existingEvidence?.evidence_notes?.trim() ?? "");
    }
  }, [open, existingEvidence?.evidence_url, existingEvidence?.evidence_notes]);

  const handleSave = async () => {
    if (!actionId || !url.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/compliance/actions/${actionId}/evidence`, {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify({ evidence_url: url.trim(), evidence_notes: notes.trim() || undefined }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; step?: string };
      if (!res.ok || !json.ok) {
        const msg =
          res.status === 409 && json.step === "site_mismatch"
            ? "Action is not in the active site"
            : json.error ?? "Failed to save evidence";
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: "Evidence attached" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!url.trim()) return;
    try {
      await navigator.clipboard.writeText(url.trim());
      setCopied(true);
      toast({ title: "URL copied" });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            Attach evidence
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="evidence-url">Evidence URL</Label>
            <div className="flex gap-2">
              <Input
                id="evidence-url"
                type="url"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 font-mono text-sm"
              />
              <Button type="button" variant="outline" size="icon" onClick={handleCopyUrl} disabled={!url.trim()} title="Copy URL">
                {copied ? <CopyCheck className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="evidence-notes" className="text-muted-foreground">Notes (optional)</Label>
            <Textarea
              id="evidence-notes"
              placeholder="Brief description..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !url.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save evidence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
