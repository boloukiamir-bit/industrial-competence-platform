"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditDrawerShell } from "@/components/shared/EditDrawerShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";
import type { RequirementStatusRow } from "./RequirementsTabContent";

type CatalogRequirement = { id: string; code: string; name: string; category: string | null };

const STATUS_OPTIONS = [
  { value: "", label: "Auto" },
  { value: "GO", label: "GO" },
  { value: "WARNING", label: "WARNING" },
  { value: "ILLEGAL", label: "ILLEGAL" },
] as const;

function toDateInput(v: string | null): string {
  if (!v) return "";
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function shortId(uuid: string): string {
  if (!uuid || uuid.length < 8) return uuid ?? "—";
  return uuid.slice(0, 8);
}

type EmployeeMin = { id: string; name: string };

export type RequirementBindingDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "create";
  /** Existing row (required when mode is "edit") */
  row?: RequirementStatusRow | null;
  /** Called after successful save so parent can refetch list */
  onSaved: () => void;
  /** Prefill for create mode (e.g. from Fix on MISSING_REQUIRED). When set, employee picker is disabled. */
  presetEmployeeId?: string | null;
  presetRequirementCode?: string | null;
  presetRequirementName?: string | null;
};

export function RequirementBindingDrawer({
  open,
  onOpenChange,
  mode,
  row = null,
  onSaved,
  presetEmployeeId = null,
  presetRequirementCode = null,
  presetRequirementName = null,
}: RequirementBindingDrawerProps) {
  const { toast } = useToast();
  const [employee_id, setEmployee_id] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employees, setEmployees] = useState<EmployeeMin[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeDropdownOpen, setEmployeeDropdownOpen] = useState(false);
  const employeeDropdownRef = useRef<HTMLDivElement>(null);

  const [fromCatalog, setFromCatalog] = useState(true);
  const [catalogRequirements, setCatalogRequirements] = useState<CatalogRequirement[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const catalogDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);

  const [requirement_code, setRequirement_code] = useState("");
  const [requirement_name, setRequirement_name] = useState("");
  const [valid_from, setValid_from] = useState("");
  const [valid_to, setValid_to] = useState("");
  const [status_override, setStatus_override] = useState("");
  const [evidence_url, setEvidence_url] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === "edit";
  const isCreate = mode === "create";

  const initial = useMemo(() => {
    if (!row) return null;
    return {
      valid_from: toDateInput(row.valid_from),
      valid_to: toDateInput(row.valid_to),
      status_override: row.status_override ?? "",
      evidence_url: row.evidence_url ?? "",
      note: row.note ?? "",
    };
  }, [row]);

  // Fetch employees/min when drawer opens in create mode
  useEffect(() => {
    if (!open || !isCreate) return;
    setEmployeesLoading(true);
    fetchJson<{ ok: true; employees: EmployeeMin[] }>("/api/employees/min")
      .then((res) => {
        if (res.ok) setEmployees(res.data.employees ?? []);
        else setEmployees([]);
      })
      .catch(() => setEmployees([]))
      .finally(() => setEmployeesLoading(false));
  }, [open, isCreate]);

  // Fetch catalog when drawer opens in create mode
  useEffect(() => {
    if (!open || !isCreate) return;
    setCatalogLoading(true);
    fetchJson<{ ok: true; requirements: CatalogRequirement[] }>("/api/hr/requirements/catalog")
      .then((res) => {
        if (res.ok) setCatalogRequirements(res.data.requirements ?? []);
        else setCatalogRequirements([]);
      })
      .catch(() => setCatalogRequirements([]))
      .finally(() => setCatalogLoading(false));
  }, [open, isCreate]);

  useEffect(() => {
    if (isEdit && row) {
      setValid_from(toDateInput(row.valid_from));
      setValid_to(toDateInput(row.valid_to));
      setStatus_override(row.status_override ?? "");
      setEvidence_url(row.evidence_url ?? "");
      setNote(row.note ?? "");
      setRequirement_code(row.requirement_code);
      setRequirement_name(row.requirement_name ?? "");
      setEmployee_id(row.employee_id);
    }
    if (isCreate && open) {
      if (presetEmployeeId || presetRequirementCode || presetRequirementName) {
        setEmployee_id(presetEmployeeId ?? "");
        setEmployeeSearch("");
        setFromCatalog(false);
        setCatalogSearch("");
        setSelectedCatalogId(null);
        setRequirement_code(presetRequirementCode ?? "");
        setRequirement_name(presetRequirementName ?? "");
      } else {
        setEmployee_id("");
        setEmployeeSearch("");
        setFromCatalog(true);
        setCatalogSearch("");
        setSelectedCatalogId(null);
        setRequirement_code("");
        setRequirement_name("");
      }
      setValid_from("");
      setValid_to("");
      setStatus_override("");
      setEvidence_url("");
      setNote("");
    }
    setError(null);
  }, [isEdit, isCreate, open, row, presetEmployeeId, presetRequirementCode, presetRequirementName]);

  const filteredEmployees = useMemo(() => {
    const q = employeeSearch.trim().toLowerCase();
    if (!q) return employees.slice(0, 50);
    return employees
      .filter((e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
      .slice(0, 50);
  }, [employees, employeeSearch]);

  const selectedEmployee = useMemo(
    () => (employee_id ? employees.find((e) => e.id === employee_id) : null),
    [employees, employee_id]
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogRequirements.slice(0, 50);
    return catalogRequirements
      .filter(
        (r) =>
          r.code.toLowerCase().includes(q) ||
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.category && r.category.toLowerCase().includes(q))
      )
      .slice(0, 50);
  }, [catalogRequirements, catalogSearch]);

  const selectedCatalog = useMemo(
    () => (selectedCatalogId ? catalogRequirements.find((r) => r.id === selectedCatalogId) : null),
    [catalogRequirements, selectedCatalogId]
  );

  const dirty = useMemo(() => {
    if (isCreate) {
      const code = requirement_code.trim().toUpperCase();
      const name = requirement_name.trim();
      return Boolean(employee_id && code && name);
    }
    if (!initial || !row) return false;
    return (
      valid_from !== initial.valid_from ||
      valid_to !== initial.valid_to ||
      status_override !== initial.status_override ||
      evidence_url !== initial.evidence_url ||
      note !== initial.note
    );
  }, [
    isCreate,
    initial,
    row,
    employee_id,
    requirement_code,
    requirement_name,
    valid_from,
    valid_to,
    status_override,
    evidence_url,
    note,
  ]);

  const handleSave = useCallback(async () => {
    if (isEdit) {
      if (!row || !dirty) return;
      setSaving(true);
      setError(null);
      const idempotency_key = `req-${row.employee_id}-${row.requirement_code}-${Date.now()}`;
      const res = await fetchJson<{ ok: true; binding_id?: string }>(
        "/api/hr/requirements/upsert",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: row.employee_id,
            requirement_code: row.requirement_code,
            requirement_name: row.requirement_name,
            valid_from: valid_from || null,
            valid_to: valid_to || null,
            status_override: status_override || null,
            evidence_url: evidence_url || null,
            note: note || null,
            idempotency_key,
          }),
        }
      );
      setSaving(false);
      if (!res.ok) {
        const msg = "error" in res ? res.error : "Failed to save";
        setError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: "Saved" });
      onOpenChange(false);
      onSaved();
      return;
    }

    // Create
    if (!employee_id || !requirement_code.trim() || !requirement_name.trim()) return;
    setSaving(true);
    setError(null);
    const codeNormalized = requirement_code.trim().toUpperCase();
    const nameNormalized = requirement_name.trim();
    const idempotency_key = `req-${employee_id}-${codeNormalized}-${Date.now()}`;
    const res = await fetchJson<{ ok: true; binding_id?: string }>(
      "/api/hr/requirements/upsert",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id,
          requirement_code: codeNormalized,
          requirement_name: nameNormalized,
          valid_from: valid_from || null,
          valid_to: valid_to || null,
          status_override: status_override || null,
          evidence_url: evidence_url || null,
          note: note || null,
          idempotency_key,
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const msg = "error" in res ? res.error : "Failed to create";
      setError(msg);
      toast({ title: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Requirement created" });
    onOpenChange(false);
    onSaved();
  }, [
    isEdit,
    row,
    dirty,
    employee_id,
    requirement_code,
    requirement_name,
    valid_from,
    valid_to,
    status_override,
    evidence_url,
    note,
    onOpenChange,
    onSaved,
    toast,
  ]);

  if (isEdit && !row) return null;

  const title = isCreate ? "Create requirement binding" : "Edit requirement binding";
  const description = isEdit && row
    ? `${row.requirement_code} — ${row.requirement_name || "Requirement"}`
    : "Add a new requirement for an employee.";
  const saveLabel = isCreate ? "Create requirement" : "Save changes";
  const saveDisabled = isCreate ? !dirty : !dirty;

  return (
    <EditDrawerShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saveDisabled}
      saveLabel={saveLabel}
      error={error}
      saveTestId={isCreate ? "requirement-binding-create" : "requirement-binding-save"}
    >
      <div className="space-y-4">
        {isCreate && (
          <div className="grid gap-2">
            <Label htmlFor="req-employee">Employee (required)</Label>
            <div className="relative" ref={employeeDropdownRef}>
              <Input
                id="req-employee"
                placeholder={
                  presetEmployeeId
                    ? employeesLoading
                      ? "Loading…"
                      : selectedEmployee
                        ? selectedEmployee.name
                        : shortId(presetEmployeeId)
                    : employeesLoading
                      ? "Loading…"
                      : "Search or select employee"
                }
                value={presetEmployeeId ? (selectedEmployee ? selectedEmployee.name : employee_id ? shortId(employee_id) : "") : selectedEmployee ? selectedEmployee.name : employeeSearch}
                onChange={(e) => {
                  if (presetEmployeeId) return;
                  const v = e.target.value;
                  setEmployeeSearch(v);
                  if (selectedEmployee && v !== selectedEmployee.name) setEmployee_id("");
                  setEmployeeDropdownOpen(true);
                }}
                onFocus={() => !presetEmployeeId && setEmployeeDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setEmployeeDropdownOpen(false), 150);
                }}
                disabled={employeesLoading || Boolean(presetEmployeeId)}
                className="bg-background"
              />
              {employeeDropdownOpen && !presetEmployeeId && (
                <div
                  className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-input bg-popover py-1 shadow-md"
                  role="listbox"
                >
                  {filteredEmployees.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {employees.length === 0 ? "No employees" : "No match"}
                    </div>
                  ) : (
                    filteredEmployees.map((e) => (
                      <button
                        key={e.id}
                        type="button"
                        role="option"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setEmployee_id(e.id);
                          setEmployeeSearch("");
                          setEmployeeDropdownOpen(false);
                        }}
                      >
                        <span className="font-medium">{e.name}</span>
                        <span className="text-muted-foreground ml-1.5 text-xs">{e.id.slice(0, 8)}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {isCreate ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="req-from-catalog" className="text-sm font-normal">
                From catalog
              </Label>
              <Switch
                id="req-from-catalog"
                checked={fromCatalog}
                onCheckedChange={(checked) => {
                  setFromCatalog(checked);
                  if (!checked) {
                    setSelectedCatalogId(null);
                    setCatalogSearch("");
                  }
                }}
              />
            </div>
            {fromCatalog && (
              <div className="grid gap-2">
                <Label htmlFor="req-catalog-picker">Search catalog</Label>
                <div className="relative" ref={catalogDropdownRef}>
                  <Input
                    id="req-catalog-picker"
                    placeholder={catalogLoading ? "Loading…" : "Search by code or name"}
                    value={
                      selectedCatalog
                        ? `${selectedCatalog.code} — ${selectedCatalog.name}`
                        : catalogSearch
                    }
                    onChange={(e) => {
                      const v = e.target.value;
                      setCatalogSearch(v);
                      if (selectedCatalog && v !== `${selectedCatalog.code} — ${selectedCatalog.name}`)
                        setSelectedCatalogId(null);
                      setCatalogDropdownOpen(true);
                    }}
                    onFocus={() => setCatalogDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setCatalogDropdownOpen(false), 150)}
                    disabled={catalogLoading}
                    className="bg-background"
                  />
                  {catalogDropdownOpen && (
                    <div
                      className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-input bg-popover py-1 shadow-md"
                      role="listbox"
                    >
                      {filteredCatalog.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          {catalogRequirements.length === 0
                            ? "No catalog items. Add some or use manual entry below."
                            : "No match"}
                        </div>
                      ) : (
                        filteredCatalog.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            role="option"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                            onMouseDown={(ev) => {
                              ev.preventDefault();
                              setSelectedCatalogId(r.id);
                              setRequirement_code(r.code);
                              setRequirement_name(r.name);
                              setCatalogSearch("");
                              setCatalogDropdownOpen(false);
                            }}
                          >
                            <span className="font-medium">{r.code}</span>
                            {r.name ? (
                              <span className="text-muted-foreground"> — {r.name}</span>
                            ) : null}
                            {r.category ? (
                              <span className="text-muted-foreground ml-1 text-xs">
                                ({r.category})
                              </span>
                            ) : null}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  You can override code/name below after selecting.
                </p>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="req-code-create">Requirement code (required)</Label>
              <Input
                id="req-code-create"
                value={requirement_code}
                onChange={(e) => setRequirement_code(e.target.value)}
                placeholder="e.g. SAFETY-01"
                className="bg-background"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="req-name-create">Requirement name (required)</Label>
              <Input
                id="req-name-create"
                value={requirement_name}
                onChange={(e) => setRequirement_name(e.target.value)}
                placeholder="e.g. Safety induction"
                className="bg-background"
              />
            </div>
          </>
        ) : (
          row && (
            <div className="grid gap-2">
              <Label className="text-muted-foreground text-xs">Requirement (read-only)</Label>
              <div className="rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                <span className="font-medium">{row.requirement_code}</span>
                {row.requirement_name ? (
                  <span className="text-muted-foreground ml-1.5">{row.requirement_name}</span>
                ) : null}
              </div>
            </div>
          )
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="req-valid-from">Valid from</Label>
            <Input
              id="req-valid-from"
              type="date"
              value={valid_from}
              onChange={(e) => setValid_from(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="req-valid-to">Valid to</Label>
            <Input
              id="req-valid-to"
              type="date"
              value={valid_to}
              onChange={(e) => setValid_to(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="req-status-override">Status override</Label>
          <select
            id="req-status-override"
            value={status_override}
            onChange={(e) => setStatus_override(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "auto"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="req-evidence-url">Evidence URL</Label>
          <Input
            id="req-evidence-url"
            type="url"
            placeholder="https://…"
            value={evidence_url}
            onChange={(e) => setEvidence_url(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="req-note">Note</Label>
          <textarea
            id="req-note"
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            placeholder="Optional note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
    </EditDrawerShell>
  );
}
