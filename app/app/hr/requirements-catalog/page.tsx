"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { OrgGuard } from "@/components/OrgGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";
import { ChevronLeft, Loader2, Pencil, Plus, PowerOff } from "lucide-react";

const CRITICALITY_OPTIONS = [
  { value: "CRITICAL", label: "CRITICAL" },
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "LOW", label: "LOW" },
] as const;

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  criticality: string;
  is_active: boolean;
};

type CatalogResponse = { ok: true; requirements: CatalogRow[] };

export default function RequirementsCatalogPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCriticality, setFormCriticality] = useState<string>("MEDIUM");
  const [formActive, setFormActive] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (!activeOnly) params.set("activeOnly", "false");
    const res = await fetchJson<CatalogResponse>(`/api/hr/requirements/catalog?${params.toString()}`);
    if (res.ok) setRows(res.data.requirements ?? []);
    else toast({ title: res.error ?? "Failed to load catalog", variant: "destructive" });
    setLoading(false);
  }, [q, activeOnly, toast]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const openAdd = () => {
    setEditing(null);
    setFormCode("");
    setFormName("");
    setFormCategory("");
    setFormDescription("");
    setFormCriticality("MEDIUM");
    setFormActive(true);
    setSheetOpen(true);
  };

  const openEdit = (row: CatalogRow) => {
    setEditing(row);
    setFormCode(row.code);
    setFormName(row.name);
    setFormCategory(row.category ?? "");
    setFormDescription(row.description ?? "");
    setFormCriticality(row.criticality ?? "MEDIUM");
    setFormActive(row.is_active);
    setSheetOpen(true);
  };

  const handleDeactivate = async (row: CatalogRow) => {
    if (!row.is_active) return;
    setDeactivatingId(row.id);
    const res = await fetchJson<{ ok: true }>(`/api/hr/requirements/catalog/${row.id}`, {
      method: "DELETE",
    });
    setDeactivatingId(null);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to deactivate", variant: "destructive" });
      return;
    }
    toast({ title: "Requirement deactivated" });
    loadCatalog();
  };

  const handleSave = async () => {
    const code = formCode.trim().toUpperCase();
    const name = formName.trim();
    if (!code || !name) {
      toast({ title: "Code and name are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await fetchJson<{ ok: true; id?: string }>("/api/hr/requirements/catalog/upsert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(editing ? { id: editing.id } : {}),
        code,
        name,
        category: formCategory.trim() || null,
        description: formDescription.trim() || null,
        criticality: formCriticality,
        is_active: formActive,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to save", variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Catalog item updated" : "Catalog item added" });
    setSheetOpen(false);
    loadCatalog();
  };

  const filteredRows = useMemo(() => rows, [rows]);

  return (
    <OrgGuard requireAdminOrHr>
      <div className="max-w-full mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center gap-3">
          <Link
            href="/app/hr"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            HR
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Requirement Catalog</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage compliance requirement catalog. Used by HR Inbox requirement binding and rules.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search by code or name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs h-9"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="active-only"
              checked={activeOnly}
              onCheckedChange={setActiveOnly}
            />
            <Label htmlFor="active-only" className="text-sm font-normal">Active only</Label>
          </div>
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add requirement
          </Button>
          <Link href="/app/hr/requirements-rules">
            <Button variant="outline" size="sm">Requirement rules</Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No catalog items. Add a requirement to use in bindings and rules.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Criticality</TableHead>
                <TableHead className="w-[80px]">Active</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-medium">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.category ?? "—"}</TableCell>
                  <TableCell>
                    <span className="rounded px-1.5 py-0.5 text-xs font-medium bg-muted">
                      {r.criticality}
                    </span>
                  </TableCell>
                  <TableCell>{r.is_active ? "Yes" : "Inactive"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      {r.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeactivate(r)}
                          disabled={deactivatingId === r.id}
                        >
                          {deactivatingId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <PowerOff className="h-3.5 w-3.5" />
                          )}
                          Deactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit requirement" : "Add requirement"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="cat-code">Code</Label>
                <Input
                  id="cat-code"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. SAFETY_BASIC"
                  disabled={!!editing}
                  className="font-mono"
                />
                {editing && <p className="text-xs text-muted-foreground">Code cannot be changed when editing.</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-name">Name</Label>
                <Input
                  id="cat-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Safety induction"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-category">Category (optional)</Label>
                <Input
                  id="cat-category"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  placeholder="e.g. Safety"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-description">Description (optional)</Label>
                <textarea
                  id="cat-description"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  placeholder="Optional description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cat-criticality">Criticality</Label>
                <select
                  id="cat-criticality"
                  value={formCriticality}
                  onChange={(e) => setFormCriticality(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {CRITICALITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="cat-active" className="text-sm font-normal">Active</Label>
                <Switch
                  id="cat-active"
                  checked={formActive}
                  onCheckedChange={setFormActive}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </OrgGuard>
  );
}
