"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useOrg } from "@/hooks/useOrg";
import { OrgGuard } from "@/components/OrgGuard";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import {
  ChevronLeft,
  Layers,
  Pencil,
  Download,
  Upload,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type LineRow = {
  id: string | null;
  line_code: string;
  line_name: string;
  leader_employee_id: string | null;
  leader_employee_number: string | null;
  leader_name: string | null;
  is_active: boolean;
  station_count: number;
};

type EmployeeOption = { id: string; employee_number: string; name: string };

function LinesContent() {
  const { currentOrg, isAdmin } = useOrg();
  const { toast } = useToast();
  const [lines, setLines] = useState<LineRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editLine, setEditLine] = useState<LineRow | null>(null);
  const [editForm, setEditForm] = useState({ line_name: "", leader_employee_id: "" as string | null, is_active: true });
  const [saving, setSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const fetchLines = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ lines: LineRow[] }>("/api/admin/master-data/lines");
      setLines(data.lines ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load lines");
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  const fetchEmployees = useCallback(async () => {
    if (!currentOrg) return;
    try {
      const data = await apiGet<{ employees?: { id: string; employeeNumber: string; name?: string }[] }>("/api/employees");
      const list = data.employees ?? [];
      setEmployees(list.map((e: { id: string; employeeNumber: string; name?: string }) => ({
        id: e.id,
        employee_number: e.employeeNumber,
        name: e.name ?? e.employeeNumber ?? "",
      })));
    } catch {
      setEmployees([]);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  useEffect(() => {
    if (editLine) {
      fetchEmployees();
      setEditForm({
        line_name: editLine.line_name,
        leader_employee_id: editLine.leader_employee_id ?? "",
        is_active: editLine.is_active,
      });
    }
  }, [editLine, fetchEmployees]);

  const handleSaveEdit = async () => {
    if (!editLine) return;
    setSaving(true);
    try {
      if (editLine.id) {
        await apiPatch("/api/admin/master-data/lines", {
          id: editLine.id,
          line_name: editForm.line_name,
          leader_employee_id: editForm.leader_employee_id || null,
          is_active: editForm.is_active,
        });
        toast({ title: "Line updated" });
      } else {
        await apiPost("/api/admin/master-data/lines", {
          line_code: editLine.line_code,
          line_name: editForm.line_name || editLine.line_code,
          leader_employee_id: editForm.leader_employee_id || null,
          is_active: editForm.is_active,
        });
        toast({ title: "Line created" });
      }
      setEditLine(null);
      fetchLines();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/admin/master-data/lines/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "area_leaders.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported area_leaders.csv" });
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Export failed", variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      toast({ title: "Select a CSV file", variant: "destructive" });
      return;
    }
    setImporting(true);
    try {
      const csv = await importFile.text();
      const res = await fetch("/api/admin/master-data/lines/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ csv }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Import failed");
      const created = (data as { created?: number }).created ?? 0;
      const updated = (data as { updated?: number }).updated ?? 0;
      toast({ title: "Import done", description: `Created: ${created}, updated: ${updated}` });
      setImportFile(null);
      fetchLines();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Import failed", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  if (!currentOrg) return null;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href="/app/admin"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Admin
        </Link>
        <Link
          href="/app/admin/master-data/stations"
          className="text-sm text-primary hover:underline"
        >
          Stations
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Master Data: Lines (Areas)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Line code, name, optional leader, is_active. Tenant: {currentOrg.name}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportLoading}
          data-testid="lines-export"
        >
          {exportLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Export CSV
        </Button>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".csv"
            className="text-sm"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            data-testid="lines-import-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={!importFile || importing}
            data-testid="lines-import"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : error ? (
        <p className="text-destructive">{error}</p>
      ) : lines.length === 0 ? (
        <p className="text-muted-foreground">No lines. Add lines or import CSV (line_code, line_name, leader_employee_number, is_active).</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Line code</th>
                <th className="text-left p-2 font-medium">Line name</th>
                <th className="text-left p-2 font-medium">Leader</th>
                <th className="text-left p-2 font-medium">Active</th>
                <th className="text-left p-2 font-medium">Stations</th>
                {isAdmin && <th className="p-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((row) => (
                <tr key={row.line_code} className="border-t">
                  <td className="p-2 font-mono">{row.line_code}</td>
                  <td className="p-2">{row.line_name}</td>
                  <td className="p-2">
                    {row.leader_name ? `${row.leader_employee_number ?? ""} — ${row.leader_name}` : "—"}
                  </td>
                  <td className="p-2">{row.is_active ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</td>
                  <td className="p-2">{row.station_count}</td>
                  {isAdmin && (
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditLine(row)}
                        data-testid={`edit-line-${row.line_code}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!editLine} onOpenChange={(open) => !open && setEditLine(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editLine?.id ? "Edit line" : "Add line"}</DialogTitle>
            <DialogDescription>
              {editLine?.id ? "Update name, leader, active." : `Line code: ${editLine?.line_code}`}
            </DialogDescription>
          </DialogHeader>
          {editLine && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Line name</Label>
                <Input
                  value={editForm.line_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, line_name: e.target.value }))}
                  placeholder="Display name"
                  data-testid="edit-line-name"
                />
              </div>
              <div>
                <Label>Leader (optional)</Label>
                <select
                  className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                  value={editForm.leader_employee_id ?? ""}
                  onChange={(e) => setEditForm((f) => ({ ...f, leader_employee_id: e.target.value || null }))}
                  data-testid="edit-line-leader"
                >
                  <option value="">— None —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.employee_number} — {emp.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                  data-testid="edit-line-active"
                />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditLine(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={saving} data-testid="edit-line-save">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MasterDataLinesPage() {
  return (
    <OrgGuard requireAdminOrHr>
      <LinesContent />
    </OrgGuard>
  );
}
