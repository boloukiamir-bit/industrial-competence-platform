"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { User, Loader2, ExternalLink, ClipboardList, Sparkles, ChevronDown } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useToast } from "@/hooks/use-toast";

type ComplianceItem = {
  compliance_id: string;
  category: string;
  code: string;
  name: string;
  status: string;
  valid_from: string | null;
  valid_to: string | null;
  evidence_url: string | null;
  notes: string | null;
  waived: boolean;
  days_left: number | null;
  employee_compliance_id: string | null;
};

type EmployeeComplianceResponse = {
  ok: boolean;
  employeeId: string;
  items?: ComplianceItem[];
};

type WorkflowTemplate = { id: string; name: string; category?: string };

const STATUS_LABELS: Record<string, string> = {
  missing: "Saknas",
  expired: "Utgånget",
  expiring: "På väg att gå ut",
  valid: "Giltigt",
  waived: "Undantaget",
};

const CATEGORY_LABELS: Record<string, string> = {
  license: "Licenser",
  medical: "Medicinskt",
  contract: "Avtal",
};

function buildPrefillNotes(item: ComplianceItem): string {
  const validTo = item.valid_to ? new Date(item.valid_to).toLocaleDateString("sv-SE") : "—";
  const evidence = item.evidence_url?.trim() || "—";
  return `${item.name} (${item.code}) — status: ${item.status}. Giltig till: ${validTo}. Bevis: ${evidence}`;
}

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;
  const className =
    status === "valid"
      ? "bg-emerald-600 text-white border-0"
      : status === "expiring"
        ? "bg-amber-500 text-white border-0"
        : status === "expired"
          ? "bg-red-600 text-white border-0"
          : status === "waived"
            ? "text-muted-foreground"
            : "bg-muted text-muted-foreground";
  return <Badge className={className}>{label}</Badge>;
}

function ItemRow({
  item,
  isAdminOrHr,
  onCreateTask,
  onEdit,
  editing,
  form,
  onFormChange,
  onSave,
  saving,
}: {
  item: ComplianceItem;
  isAdminOrHr: boolean;
  onCreateTask: (item: ComplianceItem) => void;
  onEdit: (code: string | null) => void;
  editing: boolean;
  form: { valid_from: string; valid_to: string; evidence_url: string; notes: string; waived: boolean };
  onFormChange: (f: typeof form) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const isProblematic = ["missing", "expired", "expiring"].includes(item.status);
  const validToStr = item.valid_to ? new Date(item.valid_to).toLocaleDateString("sv-SE") : "—";

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.code}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={item.status} />
            <span className="text-xs text-muted-foreground">{validToStr}</span>
          </div>
        </div>
        {isAdminOrHr && (
          <div className="flex flex-col gap-2 shrink-0">
            {isProblematic && (
              <Button size="sm" onClick={() => onCreateTask(item)} className="w-full">
                <ClipboardList className="h-4 w-4 mr-2" />
                Skapa HR-ärende
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(editing ? null : item.code)}
            >
              {editing ? "Avbryt" : "Redigera"}
            </Button>
          </div>
        )}
      </div>
      {isAdminOrHr && editing && (
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Giltig från</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => onFormChange({ ...form, valid_from: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Giltig till</Label>
              <Input
                type="date"
                value={form.valid_to}
                onChange={(e) => onFormChange({ ...form, valid_to: e.target.value })}
                className="h-9"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bevis (URL)</Label>
            <Input
              value={form.evidence_url}
              onChange={(e) => onFormChange({ ...form, evidence_url: e.target.value })}
              placeholder="https://..."
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Anteckningar</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
              rows={2}
              className="resize-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.waived}
              onCheckedChange={(c) => onFormChange({ ...form, waived: c })}
            />
            <Label className="text-sm">Undantaget</Label>
          </div>
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? "Sparar…" : "Spara"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ComplianceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  employeeName: string;
  employeeNumber?: string;
  isAdminOrHr: boolean;
  onSaved: () => void;
  /** Poster mode: show list of employees for a compliance code */
  posterContext?: {
    code: string;
    name: string;
    employees: Array<{ id: string; name: string; employee_number?: string }>;
  } | null;
  onSelectEmployee?: (id: string, name: string, employeeNumber?: string) => void;
}

export function ComplianceDrawer({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  employeeNumber = "",
  isAdminOrHr,
  onSaved,
  posterContext,
  onSelectEmployee,
}: ComplianceDrawerProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [createTaskItem, setCreateTaskItem] = useState<ComplianceItem | null>(null);
  const [createTaskPrefilledNotes, setCreateTaskPrefilledNotes] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [createTaskTemplateId, setCreateTaskTemplateId] = useState<string>("");
  const [createTaskNotes, setCreateTaskNotes] = useState<string>("");
  const [seedingTemplates, setSeedingTemplates] = useState(false);
  const [form, setForm] = useState({
    valid_from: "",
    valid_to: "",
    evidence_url: "",
    notes: "",
    waived: false,
  });
  const [saving, setSaving] = useState(false);
  const [showValidItems, setShowValidItems] = useState<Record<string, boolean>>({});

  const loadEmployeeCompliance = useCallback(async () => {
    if (!employeeId || !open) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/compliance/employee?employeeId=${encodeURIComponent(employeeId)}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as EmployeeComplianceResponse;
      if (!res.ok || !json.ok) {
        setError((json as { error?: string }).error ?? "Kunde inte ladda");
        setItems([]);
        return;
      }
      setItems(json.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId, open]);

  useEffect(() => {
    loadEmployeeCompliance();
  }, [loadEmployeeCompliance]);

  useEffect(() => {
    if (!editingCode) {
      setForm({ valid_from: "", valid_to: "", evidence_url: "", notes: "", waived: false });
      return;
    }
    const item = items.find((i) => i.code === editingCode);
    if (item) {
      setForm({
        valid_from: item.valid_from ?? "",
        valid_to: item.valid_to ?? "",
        evidence_url: item.evidence_url ?? "",
        notes: item.notes ?? "",
        waived: item.waived,
      });
    }
  }, [editingCode, items]);

  const fetchTemplatesForCreateTask = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/workflows/templates", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data.templates) ? data.templates : [];
      setTemplates(list);
      if (list.length > 0) setCreateTaskTemplateId(list[0].id);
      else setCreateTaskTemplateId("");
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (createTaskItem) {
      setCreateTaskNotes(buildPrefillNotes(createTaskItem));
      setCreateTaskPrefilledNotes(null);
      setCreateTaskTemplateId("");
      fetchTemplatesForCreateTask();
    }
  }, [createTaskItem, fetchTemplatesForCreateTask]);

  useEffect(() => {
    if (createTaskPrefilledNotes) {
      setCreateTaskNotes(createTaskPrefilledNotes);
      setCreateTaskItem(null);
      fetchTemplatesForCreateTask();
    }
  }, [createTaskPrefilledNotes, fetchTemplatesForCreateTask]);

  const handleSeedTemplatesInModal = useCallback(async () => {
    setSeedingTemplates(true);
    try {
      const res = await fetch("/api/workflows/templates/seed-defaults", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (data as { error?: string }).error ?? "Misslyckades", variant: "destructive" });
        return;
      }
      toast({ title: "4 mallar skapade" });
      await fetchTemplatesForCreateTask();
      const list = Array.isArray((data as { templates?: { id: string }[] }).templates)
        ? (data as { templates: { id: string }[] }).templates
        : [];
      if (list.length > 0) setCreateTaskTemplateId(list[0].id);
    } finally {
      setSeedingTemplates(false);
    }
  }, [fetchTemplatesForCreateTask, toast]);

  const handleCreateTaskSubmit = () => {
    if (!employeeId) return;
    let key: string | null = null;
    try {
      key = `hrprefill:${employeeId}:${Date.now()}`;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          employeeId,
          templateId: createTaskTemplateId || null,
          notes: createTaskNotes,
        })
      );
    } catch {
      key = null;
    }
    onOpenChange(false);
    setCreateTaskItem(null);
    setCreateTaskPrefilledNotes(null);
    router.push(key ? `/app/hr/templates?prefillKey=${encodeURIComponent(key)}` : "/app/hr/templates");
  };

  const problematicItems = items.filter((i) =>
    ["missing", "expired", "expiring"].includes(i.status)
  );
  const buildAllProblemsNotes = () =>
    problematicItems
      .map((i) => {
        const validTo = i.valid_to ? new Date(i.valid_to).toLocaleDateString("sv-SE") : "—";
        return `${i.name} (${i.code}) — ${STATUS_LABELS[i.status] ?? i.status}. Giltig till: ${validTo}`;
      })
      .join("\n\n");

  const handleCreateTaskAllProblems = () => {
    setCreateTaskPrefilledNotes(buildAllProblemsNotes());
    setCreateTaskItem(null);
  };

  const handleSave = async () => {
    if (!employeeId || !editingCode) return;
    setSaving(true);
    try {
      const res = await fetch("/api/compliance/employee/upsert", {
        method: "POST",
        credentials: "include",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          employee_id: employeeId,
          compliance_code: editingCode,
          valid_from: form.valid_from || null,
          valid_to: form.valid_to || null,
          evidence_url: form.evidence_url || null,
          notes: form.notes || null,
          waived: form.waived,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ title: (json as { error?: string }).error ?? "Kunde inte spara", variant: "destructive" });
        return;
      }
      toast({ title: "Sparat" });
      setEditingCode(null);
      onSaved();
      await loadEmployeeCompliance();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Kunde inte spara", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleShowValid = (cat: string) =>
    setShowValidItems((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const groupedByCategory = items.reduce(
    (acc, item) => {
      const cat = item.category in CATEGORY_LABELS ? item.category : "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    },
    {} as Record<string, ComplianceItem[]>
  );

  const renderPosterView = () =>
    posterContext && (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Medarbetare med problem: {posterContext.name} ({posterContext.code})
        </p>
        <div className="space-y-1">
          {posterContext.employees.map((emp) => (
            <button
              key={emp.id}
              type="button"
              onClick={() => onSelectEmployee?.(emp.id, emp.name, emp.employee_number)}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-muted/50 transition-colors flex items-center justify-between"
            >
              <span className="font-medium text-sm">{emp.name}</span>
              {emp.employee_number && (
                <span className="text-xs text-muted-foreground">{emp.employee_number}</span>
              )}
              <ExternalLink className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );

  const renderEmployeeView = () => {
    if (loading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (error) return <p className="text-sm text-destructive py-4">{error}</p>;
    if (items.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-4">
          Inga compliance-poster registrerade. Tilldela paket eller lägg till katalog.
        </p>
      );
    }

    return (
      <div className="space-y-6">
        {(["license", "medical", "contract"] as const).map((cat) => {
          const list = groupedByCategory[cat] ?? [];
          if (list.length === 0) return null;
          const problematic = list.filter((i) =>
            ["missing", "expired", "expiring"].includes(i.status)
          );
          const okItems = list.filter((i) => i.status === "valid" || i.status === "waived");
          const showValid = showValidItems[cat] ?? false;

          return (
            <section key={cat}>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                {CATEGORY_LABELS[cat] ?? cat}
              </h3>
              <div className="space-y-0">
                {problematic.map((item) => (
                  <ItemRow
                    key={item.compliance_id}
                    item={item}
                    isAdminOrHr={isAdminOrHr}
                    onCreateTask={setCreateTaskItem}
                    onEdit={setEditingCode}
                    editing={editingCode === item.code}
                    form={form}
                    onFormChange={setForm}
                    onSave={handleSave}
                    saving={saving}
                  />
                ))}
                {okItems.length > 0 && (
                  <Collapsible open={showValid} onOpenChange={() => toggleShowValid(cat)}>
                    <CollapsibleTrigger className="flex items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground w-full">
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${showValid ? "" : "-rotate-90"}`}
                      />
                      Visa giltiga ({okItems.length})
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {okItems.map((item) => (
                        <ItemRow
                          key={item.compliance_id}
                          item={item}
                          isAdminOrHr={isAdminOrHr}
                          onCreateTask={setCreateTaskItem}
                          onEdit={setEditingCode}
                          editing={editingCode === item.code}
                          form={form}
                          onFormChange={setForm}
                          onSave={handleSave}
                          saving={saving}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const isPosterMode = posterContext && !employeeId;
  const title = isPosterMode
    ? posterContext.name
    : employeeName || "Medarbetare";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            {title}
          </SheetTitle>
          {!isPosterMode && employeeId && (
            <div className="flex items-center gap-2 pt-1">
              {employeeNumber && (
                <span className="text-sm text-muted-foreground">{employeeNumber}</span>
              )}
              <Link
                href={`/app/employees/${employeeId}`}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                Visa profil
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          )}
        </SheetHeader>

        {!isPosterMode && employeeId && isAdminOrHr && problematicItems.length > 0 && !loading && (
          <div className="sticky top-0 z-10 py-3 bg-background border-b -mt-2 mb-2">
            <Button className="w-full" size="sm" onClick={handleCreateTaskAllProblems}>
              <ClipboardList className="h-4 w-4 mr-2" />
              Skapa HR-ärende (alla problem)
            </Button>
          </div>
        )}

        <div className="mt-6">
          {isPosterMode ? renderPosterView() : renderEmployeeView()}
        </div>

        <Dialog
          open={!!createTaskItem || !!createTaskPrefilledNotes}
          onOpenChange={(open) => {
            if (!open) {
              setCreateTaskItem(null);
              setCreateTaskPrefilledNotes(null);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Skapa HR-ärende</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Mall</Label>
                {templatesLoading ? (
                  <Skeleton className="h-10 w-full rounded-md" />
                ) : templates.length === 0 ? (
                  <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Inga HR-mallar finns. Skapa de 4 rekommenderade mallarna för att fortsätta.
                    </p>
                    <Button
                      size="sm"
                      onClick={handleSeedTemplatesInModal}
                      disabled={seedingTemplates}
                    >
                      {seedingTemplates ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Skapa mallar nu
                    </Button>
                  </div>
                ) : (
                  <Select
                    value={createTaskTemplateId}
                    onValueChange={setCreateTaskTemplateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj mall" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>Anteckningar</Label>
                <Textarea
                  value={createTaskNotes}
                  onChange={(e) => setCreateTaskNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setCreateTaskItem(null);
                  setCreateTaskPrefilledNotes(null);
                }}
              >
                Avbryt
              </Button>
              <Button
                onClick={handleCreateTaskSubmit}
                disabled={templatesLoading || seedingTemplates || templates.length === 0 || !createTaskTemplateId}
              >
                Fortsätt till mall
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
