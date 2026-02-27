"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";

const CRITICALITY_OPTIONS = [
  { value: "", label: "Inherit" },
  { value: "CRITICAL", label: "CRITICAL" },
  { value: "HIGH", label: "HIGH" },
  { value: "MEDIUM", label: "MEDIUM" },
  { value: "LOW", label: "LOW" },
] as const;

type RuleRow = {
  id: string;
  role: string;
  requirement_code: string;
  requirement_name: string;
  is_mandatory: boolean;
  criticality_override: string | null;
  created_at: string;
};

type RolesResponse = { ok: true; roles: Array<{ id: string; code: string; name: string }> };
type CatalogResponse = { ok: true; requirements: Array<{ id: string; code: string; name: string; category: string | null }> };
type RulesResponse = { ok: true; rules: RuleRow[] };

export default function RequirementRulesPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [roles, setRoles] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [catalog, setCatalog] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [formRole, setFormRole] = useState("");
  const [formRoleFreeText, setFormRoleFreeText] = useState("");
  const [formRequirementCode, setFormRequirementCode] = useState("");
  const [formRequirementName, setFormRequirementName] = useState("");
  const [formMandatory, setFormMandatory] = useState(true);
  const [formCriticality, setFormCriticality] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [updatingCriticalityId, setUpdatingCriticalityId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [demoScenarioAction, setDemoScenarioAction] = useState<"seed" | "remove" | null>(null);
  const catalogDropdownRef = useRef<HTMLDivElement>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);

  const loadRules = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<RulesResponse>("/api/hr/requirements-rules");
    if (res.ok) setRules(res.data.rules);
    else toast({ title: res.error ?? "Failed to load rules", variant: "destructive" });
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    const res = await fetchJson<RolesResponse>("/api/hr/roles");
    if (res.ok) setRoles(res.data.roles);
    else setRoles([]);
    setRolesLoading(false);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const res = await fetchJson<CatalogResponse>("/api/hr/requirements/catalog");
    if (res.ok) setCatalog(res.data.requirements);
    else setCatalog([]);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    if (addOpen) {
      loadRoles();
      loadCatalog();
    }
  }, [addOpen, loadRoles, loadCatalog]);

  const openAdd = () => {
    setFormRole("");
    setFormRoleFreeText("");
    setFormRequirementCode("");
    setFormRequirementName("");
    setFormMandatory(true);
    setFormCriticality("");
    setAddOpen(true);
  };

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalog.slice(0, 50);
    return catalog
      .filter((r) => r.code.toLowerCase().includes(q) || (r.name && r.name.toLowerCase().includes(q)))
      .slice(0, 50);
  }, [catalog, catalogSearch]);

  const handleAddSave = async () => {
    const role = roles.length > 0 ? (roles.find((r) => r.code === formRole)?.code ?? formRole) : formRoleFreeText.trim();
    if (!role.trim()) {
      toast({ title: "Select or enter a role", variant: "destructive" });
      return;
    }
    if (!formRequirementCode.trim() || !formRequirementName.trim()) {
      toast({ title: "Select a requirement from the catalog", variant: "destructive" });
      return;
    }
    setSaving(true);
    const res = await fetchJson<{ ok: true; rule: RuleRow }>("/api/hr/requirements-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: role.trim(),
        requirement_code: formRequirementCode.trim(),
        requirement_name: formRequirementName.trim(),
        is_mandatory: formMandatory,
        criticality_override: formCriticality && CRITICALITY_OPTIONS.some((o) => o.value === formCriticality) ? formCriticality : null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to create rule", variant: "destructive" });
      return;
    }
    toast({ title: "Rule created" });
    setAddOpen(false);
    loadRules();
  };

  const handleToggleMandatory = async (id: string, is_mandatory: boolean, criticality_override: string | null) => {
    setTogglingId(id);
    const res = await fetchJson<{ ok: true }>(`/api/hr/requirements-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mandatory, criticality_override: criticality_override ?? null }),
    });
    setTogglingId(null);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to update", variant: "destructive" });
      return;
    }
    toast({ title: is_mandatory ? "Mandatory" : "Optional" });
    loadRules();
  };

  const handleCriticalityChange = async (id: string, criticality_override: string | null, is_mandatory: boolean) => {
    setUpdatingCriticalityId(id);
    const res = await fetchJson<{ ok: true }>(`/api/hr/requirements-rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_mandatory, criticality_override: criticality_override ?? null }),
    });
    setUpdatingCriticalityId(null);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to update criticality", variant: "destructive" });
      return;
    }
    toast({ title: criticality_override ? `Criticality: ${criticality_override}` : "Criticality: Inherit" });
    loadRules();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const res = await fetchJson<{ ok: true }>(`/api/hr/requirements-rules/${id}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed to delete", variant: "destructive" });
      return;
    }
    toast({ title: "Rule deleted" });
    loadRules();
  };

  const handleDemoScenario = async (action: "seed" | "remove") => {
    setDemoScenarioAction(action);
    const res = await fetchJson<{ ok: true; seeded?: boolean; removed?: boolean; catalogDeactivated?: boolean }>(
      "/api/admin/demo-scenarios/requirements",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }
    );
    setDemoScenarioAction(null);
    if (!res.ok) {
      toast({ title: res.error ?? "Failed", variant: "destructive" });
      return;
    }
    if (action === "seed") {
      toast({ title: "Demo scenario seeded" });
    } else {
      const msg = res.data?.catalogDeactivated
        ? "Demo scenario removed; catalog item deactivated"
        : "Demo scenario removed";
      toast({ title: msg });
    }
    loadRules();
  };

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
            <h1 className="text-xl font-semibold tracking-tight">Requirement Rules</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Role → mandatory requirements. Missing bindings appear as ILLEGAL in HR Inbox → Requirements.
            </p>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add rule
          </Button>
          <Link href="/app/hr/requirements-catalog">
            <Button variant="outline" size="sm">Requirement catalog</Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoScenario("seed")}
            disabled={demoScenarioAction !== null}
          >
            {demoScenarioAction === "seed" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Seed demo scenario
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDemoScenario("remove")}
            disabled={demoScenarioAction !== null}
          >
            {demoScenarioAction === "remove" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Remove demo scenario
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading…
          </div>
        ) : rules.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            No rules yet. Add a rule to require a requirement for a role (e.g. Operator → SAFETY).
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead className="w-[120px]">Mandatory</TableHead>
                <TableHead className="w-[140px]">Criticality</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.role}</TableCell>
                  <TableCell>
                    <span className="font-medium">{r.requirement_code}</span>
                    {r.requirement_name ? (
                      <span className="text-muted-foreground text-xs ml-1.5">{r.requirement_name}</span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={r.is_mandatory}
                      onCheckedChange={(checked) => handleToggleMandatory(r.id, checked, r.criticality_override)}
                      disabled={togglingId === r.id}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.criticality_override ? (
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground shrink-0">
                          {r.criticality_override}
                        </span>
                      ) : null}
                      <select
                        value={r.criticality_override ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          handleCriticalityChange(r.id, v ? v : null, r.is_mandatory);
                        }}
                        disabled={updatingCriticalityId === r.id}
                        className="h-8 min-w-[100px] rounded-md border border-input bg-background px-2 py-1 text-xs"
                      >
                        {CRITICALITY_OPTIONS.map((o) => (
                          <option key={o.value || "inherit"} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {updatingCriticalityId === r.id ? (
                        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(r.id)}
                      disabled={deletingId === r.id}
                    >
                      {deletingId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Sheet open={addOpen} onOpenChange={setAddOpen}>
          <SheetContent className="sm:max-w-md">
            <SheetHeader>
              <SheetTitle>Add rule</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {roles.length > 0 ? (
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">Select role</option>
                    {roles.map((ro) => (
                      <option key={ro.id} value={ro.code}>
                        {ro.code} — {ro.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label>Role (free text)</Label>
                  <Input
                    value={formRoleFreeText}
                    onChange={(e) => setFormRoleFreeText(e.target.value)}
                    placeholder="e.g. Operator"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Requirement (from catalog)</Label>
                <div className="relative" ref={catalogDropdownRef}>
                  <Input
                    placeholder={catalogLoading ? "Loading…" : "Search and select"}
                    value={
                      formRequirementCode && formRequirementName
                        ? `${formRequirementCode} — ${formRequirementName}`
                        : catalogSearch
                    }
                    onChange={(e) => {
                      setCatalogSearch(e.target.value);
                      if (formRequirementCode && e.target.value !== `${formRequirementCode} — ${formRequirementName}`) {
                        setFormRequirementCode("");
                        setFormRequirementName("");
                      }
                      setCatalogDropdownOpen(true);
                    }}
                    onFocus={() => setCatalogDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCatalogDropdownOpen(false), 150)}
                    disabled={catalogLoading}
                  />
                  {catalogDropdownOpen && (
                    <div
                      className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-input bg-popover py-1 shadow-md"
                      role="listbox"
                    >
                      {filteredCatalog.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {catalog.length === 0 ? "No catalog items. Add requirements to the catalog first." : "No match"}
                        </div>
                      ) : (
                        filteredCatalog.map((req) => (
                          <button
                            key={req.id}
                            type="button"
                            role="option"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              setFormRequirementCode(req.code);
                              setFormRequirementName(req.name);
                              setCatalogSearch("");
                              setCatalogDropdownOpen(false);
                            }}
                          >
                            <span className="font-medium">{req.code}</span>
                            {req.name ? <span className="text-muted-foreground"> — {req.name}</span> : null}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="add-mandatory" className="text-sm font-normal">
                  Mandatory
                </Label>
                <Switch
                  id="add-mandatory"
                  checked={formMandatory}
                  onCheckedChange={setFormMandatory}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="add-criticality">Criticality</Label>
                <select
                  id="add-criticality"
                  value={formCriticality}
                  onChange={(e) => setFormCriticality(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {CRITICALITY_OPTIONS.map((o) => (
                    <option key={o.value || "inherit"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Override for synthetic MISSING_REQUIRED rows; Inherit = MEDIUM.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleAddSave} disabled={saving}>
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
