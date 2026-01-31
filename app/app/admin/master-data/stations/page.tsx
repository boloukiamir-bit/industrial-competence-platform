"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useOrg } from "@/hooks/useOrg";
import { OrgGuard } from "@/components/OrgGuard";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost, apiPatch } from "@/lib/apiClient";
import { StationsLinesPanel } from "@/components/admin/StationsLinesPanel";
import type { LineMeta } from "@/lib/normalize";
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

type StationRow = {
  id: string;
  station_code: string;
  station_name: string;
  line_code: string;
  is_active: boolean;
};

function StationsContent() {
  const { currentOrg, isAdminOrHr } = useOrg();
  const { toast } = useToast();
  const [stations, setStations] = useState<StationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editStation, setEditStation] = useState<StationRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editForm, setEditForm] = useState({ station_code: "", station_name: "", line_code: "", is_active: true });
  const [addForm, setAddForm] = useState({ station_code: "", station_name: "", line_code: "", is_active: true });
  const [saving, setSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [linesList, setLinesList] = useState<LineMeta[]>([]);

  const fetchStations = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ stations: StationRow[] }>("/api/admin/master-data/stations");
      setStations(data.stations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stations");
    } finally {
      setLoading(false);
    }
  }, [currentOrg]);

  useEffect(() => {
    fetchStations();
  }, [fetchStations]);

  useEffect(() => {
    if (editStation) {
      setEditForm({
        station_code: editStation.station_code,
        station_name: editStation.station_name,
        line_code: editStation.line_code,
        is_active: editStation.is_active,
      });
    }
  }, [editStation]);

  const handleSaveEdit = async () => {
    if (!editStation) return;
    setSaving(true);
    try {
      await apiPatch("/api/admin/master-data/stations", {
        id: editStation.id,
        station_code: editForm.station_code,
        station_name: editForm.station_name,
        line_code: editForm.line_code,
        is_active: editForm.is_active,
      });
      toast({ title: "Station updated" });
      setEditStation(null);
      fetchStations();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (!addForm.line_code.trim() || !addForm.station_code.trim()) {
      toast({ title: "Line code and station code required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/admin/master-data/stations", {
        line_code: addForm.line_code.trim(),
        station_code: addForm.station_code.trim(),
        station_name: addForm.station_name.trim() || addForm.station_code.trim(),
        is_active: addForm.is_active,
      });
      toast({ title: "Station created" });
      setAddOpen(false);
      setAddForm({ station_code: "", station_name: "", line_code: "", is_active: true });
      fetchStations();
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : "Create failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const res = await fetch("/api/admin/master-data/stations/export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "stations.csv";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported stations.csv" });
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
      const res = await fetch("/api/admin/master-data/stations/import", {
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
      fetchStations();
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
          href="/app/admin/master-data/lines"
          className="text-sm text-primary hover:underline"
        >
          Lines
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Layers className="h-6 w-6" />
          Master Data: Stations
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stations by line. Tenant: {currentOrg.name}. Add a station and see it in Line Overview immediately.
        </p>
        <div className="mt-2">
          <StationsLinesPanel onLinesLoaded={setLinesList} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exportLoading}
          data-testid="stations-export"
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
            data-testid="stations-import-file"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleImport}
            disabled={!importFile || importing}
            data-testid="stations-import"
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
      ) : stations.length === 0 ? (
        <p className="text-muted-foreground">No stations. Add stations or import CSV (line_code, station_code, station_name, is_active).</p>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-2 font-medium">Line</th>
                <th className="text-left p-2 font-medium">Station code</th>
                <th className="text-left p-2 font-medium">Station name</th>
                <th className="text-left p-2 font-medium">Active</th>
                {isAdminOrHr && <th className="p-2 w-16" />}
              </tr>
            </thead>
            <tbody>
              {stations.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="p-2 font-mono">{row.line_code}</td>
                  <td className="p-2 font-mono">{row.station_code}</td>
                  <td className="p-2">{row.station_name}</td>
                  <td className="p-2">{row.is_active ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-muted-foreground" />}</td>
                  {isAdminOrHr && (
                    <td className="p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditStation(row)}
                        data-testid={`edit-station-${row.id}`}
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add station</DialogTitle>
            <DialogDescription>New station will appear in Line Overview immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Line code</Label>
              {linesList.length > 0 ? (
                <select
                  value={addForm.line_code}
                  onChange={(e) => setAddForm((f) => ({ ...f, line_code: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="add-station-line"
                >
                  <option value="">Select line…</option>
                  {linesList.map((l) => (
                    <option key={l.lineCode} value={l.lineCode}>
                      {l.lineName} ({l.lineCode})
                      {typeof l.stationCount === "number" ? ` — ${l.stationCount} stations` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={addForm.line_code}
                  onChange={(e) => setAddForm((f) => ({ ...f, line_code: e.target.value }))}
                  placeholder="e.g. BEA"
                  data-testid="add-station-line"
                />
              )}
            </div>
            <div>
              <Label>Station code</Label>
              <Input
                value={addForm.station_code}
                onChange={(e) => setAddForm((f) => ({ ...f, station_code: e.target.value }))}
                placeholder="e.g. ST01"
                data-testid="add-station-code"
              />
            </div>
            <div>
              <Label>Station name</Label>
              <Input
                value={addForm.station_name}
                onChange={(e) => setAddForm((f) => ({ ...f, station_name: e.target.value }))}
                placeholder="Display name"
                data-testid="add-station-name"
              />
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={addForm.is_active}
                onChange={(e) => setAddForm((f) => ({ ...f, is_active: e.target.checked }))}
                data-testid="add-station-active"
              />
              <span className="text-sm">Active</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving} data-testid="add-station-save">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editStation} onOpenChange={(open) => !open && setEditStation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit station</DialogTitle>
            <DialogDescription>Update code, name, line, active.</DialogDescription>
          </DialogHeader>
          {editStation && (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Line code</Label>
                {linesList.length > 0 ? (
                  <select
                    value={editForm.line_code}
                    onChange={(e) => setEditForm((f) => ({ ...f, line_code: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    data-testid="edit-station-line"
                  >
                    <option value="">Select line…</option>
                    {linesList.map((l) => (
                      <option key={l.lineCode} value={l.lineCode}>
                        {l.lineName} ({l.lineCode})
                        {typeof l.stationCount === "number" ? ` — ${l.stationCount} stations` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={editForm.line_code}
                    onChange={(e) => setEditForm((f) => ({ ...f, line_code: e.target.value }))}
                    placeholder="e.g. BEA"
                    data-testid="edit-station-line"
                  />
                )}
              </div>
              <div>
                <Label>Station code</Label>
                <Input
                  value={editForm.station_code}
                  onChange={(e) => setEditForm((f) => ({ ...f, station_code: e.target.value }))}
                  placeholder="e.g. ST01"
                  data-testid="edit-station-code"
                />
              </div>
              <div>
                <Label>Station name</Label>
                <Input
                  value={editForm.station_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, station_name: e.target.value }))}
                  placeholder="Display name"
                  data-testid="edit-station-name"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked }))}
                  data-testid="edit-station-active"
                />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditStation(null)}>Cancel</Button>
                <Button onClick={handleSaveEdit} disabled={saving} data-testid="edit-station-save">
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

export default function MasterDataStationsPage() {
  return (
    <OrgGuard requireAdminOrHr>
      <StationsContent />
    </OrgGuard>
  );
}
