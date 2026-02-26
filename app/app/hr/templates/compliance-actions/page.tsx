"use client";

import { useState, useEffect, useCallback } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileText, Loader2, Pencil } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useToast } from "@/hooks/use-toast";
import { buildCode } from "@/lib/hrTemplatesCompliance";

type TemplateRow = {
  id: string;
  site_id: string | null;
  code: string;
  name: string;
  is_active: boolean;
  updated_at: string | null;
  content: { action_type?: string; channel?: string; title?: string; body?: string };
};

type ListResponse = {
  ok: boolean;
  templates: TemplateRow[];
  activeSiteId: string | null;
  activeSiteName: string | null;
};

const ACTION_TYPES = ["request_renewal", "request_evidence", "notify_employee", "mark_waived_review"] as const;
const CHANNELS = ["email", "sms", "note"] as const;

function replaceVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "—");
}

export default function ComplianceTemplatesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ListResponse | null>(null);
  const [scopeFilter, setScopeFilter] = useState<"all" | "org" | "site">("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [form, setForm] = useState({ name: "", title: "", body: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hr/templates/compliance-actions/list", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as ListResponse & { error?: string };
      if (res.ok && json.ok) {
        setData(json);
      } else {
        setData(null);
        toast({ title: json?.error ?? "Failed to load templates", variant: "destructive" });
      }
    } catch (err) {
      setData(null);
      toast({ title: err instanceof Error ? err.message : "Failed to load templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const templates = data?.templates ?? [];
  const filtered = templates.filter((t) => {
    const at = t.content?.action_type ?? "";
    const ch = t.content?.channel ?? "";
    if (scopeFilter === "org" && t.site_id != null) return false;
    if (scopeFilter === "site" && t.site_id == null) return false;
    if (actionFilter !== "all" && at !== actionFilter) return false;
    if (channelFilter !== "all" && ch !== channelFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openEditor = (t: TemplateRow | null) => {
    setEditing(t);
    if (t) {
      setForm({
        name: t.name,
        title: (t.content?.title as string) ?? "",
        body: (t.content?.body as string) ?? "",
        is_active: t.is_active,
      });
    } else {
      setForm({ name: "", title: "", body: "", is_active: true });
    }
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch("/api/hr/templates/compliance-actions/upsert", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          id: editing.id,
          scope: editing.site_id ? "site" : "org",
          action_type: editing.content?.action_type ?? "request_renewal",
          channel: editing.content?.channel ?? "email",
          name: form.name,
          title: form.title,
          body: form.body,
          is_active: form.is_active,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (json as { error?: string }).error ?? "Failed to save", variant: "destructive" });
        return;
      }
      toast({ title: "Saved" });
      setEditorOpen(false);
      loadList();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, is_active: boolean) => {
    try {
      const res = await fetch("/api/hr/templates/compliance-actions/toggle", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id, is_active }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (json as { error?: string }).error ?? "Failed", variant: "destructive" });
        return;
      }
      toast({ title: is_active ? "Enabled" : "Disabled" });
      loadList();
    } catch {
      toast({ title: "Failed", variant: "destructive" });
    }
  };

  const sampleVars: Record<string, string> = {
    employee_name: "Jane Doe",
    compliance_name: "Forklift license",
    compliance_code: "FL-01",
    due_date: "2025-03-01",
    days_left: "25",
    site_name: "Main site",
    line: "Line A",
    owner_email: "hr@example.com",
    as_of: new Date().toISOString().slice(0, 10),
  };
  const previewTitle = replaceVars(form.title, sampleVars);
  const previewBody = replaceVars(form.body, sampleVars);

  return (
    <OrgGuard>
      <div className="max-w-full mx-auto px-4 py-6 space-y-6">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">Compliance action templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Draft templates for request renewal, request evidence, notify employee, and waived review.
          </p>
        </header>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-normal text-muted-foreground">
            Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name or code"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs h-9"
          />
          <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as typeof scopeFilter)}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All scope</SelectItem>
              <SelectItem value="org">Org</SelectItem>
              <SelectItem value="site">Site</SelectItem>
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {ACTION_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No templates match the filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left py-2 px-3 font-medium">Name</th>
                      <th className="text-left py-2 px-3 font-medium">Code</th>
                      <th className="text-left py-2 px-3 font-medium">Scope</th>
                      <th className="text-left py-2 px-3 font-medium">Action / Channel</th>
                      <th className="text-left py-2 px-3 font-medium">Active</th>
                      <th className="text-left py-2 px-3 font-medium">Updated</th>
                      <th className="w-[80px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{t.name}</td>
                        <td className="py-2 px-3 text-muted-foreground font-mono text-xs">{t.code}</td>
                        <td className="py-2 px-3">{t.site_id ? "Site" : "Org"}</td>
                        <td className="py-2 px-3">
                          {t.content?.action_type ?? "—"} / {t.content?.channel ?? "—"}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={t.is_active ? "default" : "secondary"}>
                            {t.is_active ? "Yes" : "No"}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">
                          {t.updated_at ? new Date(t.updated_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2 px-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            onClick={() => openEditor(t)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 ml-1"
                            onClick={() => handleToggle(t.id, !t.is_active)}
                          >
                            {t.is_active ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {editing ? "Edit template" : "New template"}
              </SheetTitle>
            </SheetHeader>
            {editing && (
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Template name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject (title)</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Subject line with {{variables}}"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Body</Label>
                  <Textarea
                    value={form.body}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    rows={8}
                    className="resize-none font-mono text-xs"
                    placeholder="Body with {{employee_name}}, {{compliance_name}}, etc."
                  />
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <Label className="text-xs">Preview (sample data)</Label>
                  <p className="text-sm font-medium">{previewTitle}</p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{previewBody}</pre>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditorOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </OrgGuard>
  );
}
