"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { OrgGuard } from "@/components/OrgGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, AlertTriangle, Clock, FileX2, TrendingUp } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";

type OverviewRow = {
  employee_id: string;
  employee_name: string;
  employee_number: string;
  line: string | null;
  department: string | null;
  site_id: string | null;
  site_name: string;
  compliance_id: string;
  compliance_code: string;
  compliance_name: string;
  category: string;
  status: string;
  valid_to: string | null;
  days_left: number | null;
};

type OverviewResponse = {
  ok: boolean;
  rows?: OverviewRow[];
  activeSiteId?: string | null;
  activeSiteName?: string | null;
  error?: string;
  step?: string;
};

type DigestBucket = "critical" | "due7" | "due30";

function bucketRow(row: OverviewRow): DigestBucket | null {
  if (row.status === "missing" || row.status === "expired") return "critical";
  if (row.status === "expiring" && row.days_left != null) {
    if (row.days_left >= 0 && row.days_left <= 7) return "due7";
    if (row.days_left >= 0 && row.days_left <= 30) return "due30";
  }
  return null;
}

export default function ComplianceDigestPage() {
  const { isAdminOrHr } = useOrg();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const { toast } = useToast();

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/compliance/overview", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = (await res.json()) as OverviewResponse;
      if (!res.ok || !json.ok) {
        const err = json as { error?: string; step?: string };
        setError(err.error ?? (err.step ? `${err.step}: failed` : "Failed to load"));
        setData(null);
        return;
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const buckets = useMemo(() => {
    const rows = data?.rows ?? [];
    const critical: OverviewRow[] = [];
    const due7: OverviewRow[] = [];
    const due30: OverviewRow[] = [];
    for (const r of rows) {
      const b = bucketRow(r);
      if (b === "critical") critical.push(r);
      else if (b === "due7") due7.push(r);
      else if (b === "due30") due30.push(r);
    }
    return { critical, due7, due30 };
  }, [data?.rows]);

  const topDrivers = useMemo(() => {
    const rows = data?.rows ?? [];
    const counts = new Map<
      string,
      { code: string; name: string; category: string; critical: number; expiring30: number }
    >();
    for (const r of rows) {
      const key = r.compliance_id;
      if (!counts.has(key)) {
        counts.set(key, {
          code: r.compliance_code,
          name: r.compliance_name,
          category: r.category,
          critical: 0,
          expiring30: 0,
        });
      }
      const c = counts.get(key)!;
      if (r.status === "missing" || r.status === "expired") c.critical++;
      else if (r.status === "expiring" && r.days_left != null && r.days_left >= 0 && r.days_left <= 30)
        c.expiring30++;
    }
    return [...counts.values()]
      .filter((x) => x.critical + x.expiring30 > 0)
      .map((x) => ({ ...x, total: x.critical + x.expiring30 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [data?.rows]);

  const handleExport = useCallback(async () => {
    if (!isAdminOrHr) return;
    try {
      const res = await fetch("/api/compliance/digest/export", {
        credentials: "include",
        headers: withDevBearer(),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast({
          title: "Export failed",
          description: (j as { error?: string }).error ?? `HTTP ${res.status}`,
          variant: "destructive",
        });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compliance-digest-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Exported", description: "Digest CSV downloaded." });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }, [isAdminOrHr, toast]);

  const TableSection = ({
    title,
    count,
    rows,
    bucket,
  }: {
    title: string;
    count: number;
    rows: OverviewRow[];
    bucket: DigestBucket;
  }) => (
    <Card>
      <CardContent className="pt-4">
        <h3 className="font-medium mb-2 flex items-center gap-2">
          {bucket === "critical" && <AlertTriangle className="h-4 w-4 text-destructive" />}
          {bucket === "due7" && <Clock className="h-4 w-4 text-amber-500" />}
          {bucket === "due30" && <FileX2 className="h-4 w-4 text-muted-foreground" />}
          {title}
          <Badge variant="secondary" className="font-normal">
            {count}
          </Badge>
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">None</p>
        ) : (
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Employee</th>
                  <th className="text-left py-2 font-medium">Compliance</th>
                  <th className="text-left py-2 font-medium">Status</th>
                  <th className="text-right py-2 font-medium">Days / Valid to</th>
                  <th className="text-left py-2 font-medium">Site</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, idx) => (
                  <tr key={`${r.employee_id}-${r.compliance_id}-${idx}`} className="border-b border-border/50">
                    <td className="py-2">
                      <span className="font-medium">{r.employee_name}</span>
                      {r.employee_number && (
                        <span className="text-xs text-muted-foreground block">#{r.employee_number}</span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {r.compliance_code} – {r.compliance_name}
                    </td>
                    <td className="py-2">
                      <Badge variant={r.status === "expired" ? "destructive" : r.status === "missing" ? "destructive" : "secondary"}>
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      {r.days_left != null ? (
                        <Badge variant={r.days_left <= 7 ? "destructive" : "secondary"}>{r.days_left}d</Badge>
                      ) : (
                        <span className="text-muted-foreground">{r.valid_to ? new Date(r.valid_to).toLocaleDateString() : "—"}</span>
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground">{r.site_name || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 10 && (
          <p className="text-xs text-muted-foreground mt-2">Showing top 10 of {rows.length}</p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <OrgGuard>
      <div className="max-w-full mx-auto px-4 py-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Weekly Compliance Digest</h1>
            <p className="text-sm text-muted-foreground">What to fix this week</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="font-normal text-muted-foreground">
              Site: {data?.activeSiteId ? (data?.activeSiteName ?? "Unknown site") : "All"}
            </Badge>
            {isAdminOrHr && (
              <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
                <Download className="h-4 w-4 mr-1.5" />
                Export CSV
              </Button>
            )}
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <TableSection
              title="Critical (Missing + Expired)"
              count={buckets.critical.length}
              rows={buckets.critical}
              bucket="critical"
            />
            <TableSection
              title="Due in 7 days"
              count={buckets.due7.length}
              rows={buckets.due7}
              bucket="due7"
            />
            <TableSection
              title="Due in 30 days"
              count={buckets.due30.length}
              rows={buckets.due30}
              bucket="due30"
            />

            <Card>
              <CardContent className="pt-4">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  Top drivers (missing/expired + expiring ≤30d)
                </h3>
                {topDrivers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">None</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Item</th>
                          <th className="text-right py-2 font-medium w-20">Critical</th>
                          <th className="text-right py-2 font-medium w-20">Expiring ≤30</th>
                          <th className="text-right py-2 font-medium w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDrivers.map((r) => (
                          <tr key={r.code} className="border-b border-border/50">
                            <td className="py-2">
                              <span className="font-medium">{r.code}</span>
                              <span className="text-muted-foreground"> – {r.name}</span>
                            </td>
                            <td className="text-right tabular-nums">{r.critical}</td>
                            <td className="text-right tabular-nums">{r.expiring30}</td>
                            <td className="text-right tabular-nums font-medium">{r.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </OrgGuard>
  );
}
