"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";
import { getSeverityFromSignals, severityToBadgeVariant } from "@/lib/ui/severity";
import { RequirementBindingDrawer } from "./RequirementBindingDrawer";

const LIMIT = 50;

export type RequirementStatusRow = {
  org_id: string;
  site_id: string | null;
  employee_id: string;
  requirement_code: string;
  requirement_name: string;
  requirement_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  status_override: string | null;
  evidence_url: string | null;
  note: string | null;
  computed_status: string;
  status_reason: string;
  criticality: string;
};

type RequirementsResponse = {
  ok: true;
  rows: RequirementStatusRow[];
  total: number;
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

function shortId(uuid: string): string {
  if (!uuid || uuid.length < 8) return uuid ?? "—";
  return uuid.slice(0, 8);
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "ILLEGAL", label: "ILLEGAL" },
  { value: "WARNING", label: "WARNING" },
  { value: "GO", label: "GO" },
] as const;

export function RequirementsTabContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "";
  const q = (searchParams.get("q") ?? "").trim();
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);

  const [rows, setRows] = useState<RequirementStatusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState(q);
  const [selectedRow, setSelectedRow] = useState<RequirementStatusRow | null>(null);
  const [drawerMode, setDrawerMode] = useState<"edit" | "create">("edit");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createPresets, setCreatePresets] = useState<{
    employeeId: string;
    requirementCode: string;
    requirementName: string;
  } | null>(null);
  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const refetch = useCallback(() => {
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(offset));
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    fetchJson<RequirementsResponse>(`/api/hr/requirements?${params.toString()}`)
      .then((res) => {
        if (!res.ok) return;
        setRows(res.data.rows);
        setTotal(res.data.total);
        setError(null);
      })
      .catch(() => {});
  }, [status, q, offset]);

  const setParams = useCallback(
    (updates: { status?: string; q?: string; offset?: number }) => {
      const next = new URLSearchParams(searchParams);
      if (updates.status !== undefined) {
        if (updates.status) next.set("status", updates.status);
        else next.delete("status");
      }
      if (updates.q !== undefined) {
        if (updates.q) next.set("q", updates.q);
        else next.delete("q");
      }
      if (updates.offset !== undefined) {
        if (updates.offset > 0) next.set("offset", String(updates.offset));
        else next.delete("offset");
      }
      router.push(`/app/hr/inbox?${next.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("limit", String(LIMIT));
    params.set("offset", String(offset));
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    fetchJson<RequirementsResponse>(`/api/hr/requirements?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) {
          setRows([]);
          setTotal(0);
          setError(typeof res.error === "string" ? res.error : "Failed to load requirements");
          return;
        }
        setRows(res.data.rows);
        setTotal(res.data.total);
        setError(null);
      })
      .catch(() => {
        if (!cancelled) {
          setRows([]);
          setTotal(0);
          setError("Failed to load requirements");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [status, q, offset]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ q: searchInput.trim(), offset: 0 });
  };

  const prevPage = () => setParams({ offset: Math.max(0, offset - LIMIT) });
  const nextPage = () => setParams({ offset: offset + LIMIT });
  const hasPrev = offset > 0;
  const hasNext = offset + rows.length < total;

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-destructive text-sm">
        {error}
      </div>
    );
  }

  const openCreateDrawer = () => {
    setSelectedRow(null);
    setCreatePresets(null);
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  const openEditDrawer = (r: RequirementStatusRow) => {
    setSelectedRow(r);
    setCreatePresets(null);
    setDrawerMode("edit");
    setDrawerOpen(true);
  };

  const openFixDrawer = (r: RequirementStatusRow) => {
    setSelectedRow(null);
    setCreatePresets({
      employeeId: r.employee_id,
      requirementCode: r.requirement_code,
      requirementName: r.requirement_name ?? "",
    });
    setDrawerMode("create");
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium tabular-nums">
            Requirements ({total})
          </h2>
          <Button onClick={openCreateDrawer} size="sm">
            Add requirement
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(e) => setParams({ status: e.target.value, offset: 0 })}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <form onSubmit={handleSearchSubmit} className="flex gap-1">
            <input
              type="search"
              placeholder="Search requirement…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 w-48 rounded-md border border-input bg-background px-3 py-1 text-sm placeholder:text-muted-foreground"
            />
            <Button type="submit" variant="secondary" size="sm">
              Search
            </Button>
          </form>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              onClick={prevPage}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={nextPage}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-muted-foreground text-sm max-w-sm">
            No requirements found.
          </p>
          <p className="text-muted-foreground text-xs max-w-sm">
            Try adjusting the status filter or search, or add a requirement.
          </p>
          <Button onClick={openCreateDrawer} size="sm">
            Add requirement
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead className="tabular-nums">Valid to</TableHead>
              <TableHead className="w-[1%]">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const level = getSeverityFromSignals(
                r.computed_status === "ILLEGAL"
                  ? { legitimacy: "LEGAL_STOP" }
                  : r.computed_status === "WARNING"
                    ? { readiness: "WARNING" }
                    : {}
              );
              const { variant, className } = severityToBadgeVariant(level);
              const isMissingRequired =
                r.computed_status === "ILLEGAL" && r.status_reason === "MISSING_REQUIRED";
              return (
                <TableRow
                  key={`${r.employee_id}-${r.requirement_code}`}
                  className="cursor-pointer"
                  onClick={() =>
                    isMissingRequired ? openFixDrawer(r) : openEditDrawer(r)
                  }
                >
                  <TableCell>
                    <Badge variant={variant} className={className} size="sm">
                      {r.computed_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{r.requirement_code}</span>
                    {r.requirement_name ? (
                      <span className="text-muted-foreground text-xs ml-1.5">
                        {r.requirement_name}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/app/employees/${encodeURIComponent(r.employee_id)}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {shortId(r.employee_id)}
                    </Link>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatDate(r.valid_to)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      {r.evidence_url ? (
                        <a
                          href={r.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          title="Open evidence"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        "—"
                      )}
                      {isMissingRequired && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            openFixDrawer(r);
                          }}
                        >
                          Fix
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <RequirementBindingDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={drawerMode}
        row={selectedRow}
        onSaved={refetch}
        presetEmployeeId={createPresets?.employeeId}
        presetRequirementCode={createPresets?.requirementCode}
        presetRequirementName={createPresets?.requirementName}
      />
    </div>
  );
}
