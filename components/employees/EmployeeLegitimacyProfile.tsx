"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, Ban } from "lucide-react";
import { withDevBearer } from "@/lib/devBearer";

type LegitimacyStatus = "GO" | "WARNING" | "ILLEGAL" | "RESTRICTED";

interface LegitimacyResponse {
  ok: boolean;
  employee?: { id: string; name: string; employee_number: string };
  legitimacy?: { status: LegitimacyStatus; blockers: string[]; warnings: string[] };
  compliance?: {
    items: Array<{
      requirement_id: string;
      code: string;
      name: string;
      expiry_date: string | null;
      reminder_offset_days: number;
      expiry_status: "VALID" | "WARNING" | "ILLEGAL";
    }>;
    nearest_expiry_date: string | null;
    illegal_count: number;
    warning_count: number;
  };
  evidence?: { illegal_items: string[]; warning_items: string[] };
  error?: string;
  step?: string;
}

const INITIAL_ROWS = 8;
const INITIAL_EVIDENCE = 3;

export function EmployeeLegitimacyProfile({
  employeeId,
  asOfDate,
}: {
  employeeId: string;
  asOfDate: string;
}) {
  const [data, setData] = useState<LegitimacyResponse | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const params = new URLSearchParams();
    if (asOfDate) params.set("date", asOfDate);
    const url = `/api/employees/${employeeId}/legitimacy${params.toString() ? `?${params.toString()}` : ""}`;
    fetch(url, { credentials: "include", headers: withDevBearer() })
      .then((res) => {
        if (cancelled) return;
        setStatus(res.status);
        return res.json().catch(() => ({}));
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, asOfDate]);

  if (loading) {
    return (
      <Card data-testid="legitimacy-panel">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status === 401 || status === 403) {
    return (
      <Card data-testid="legitimacy-panel">
        <CardContent className="py-8 text-center text-muted-foreground">
          Not authorized
        </CardContent>
      </Card>
    );
  }

  if (status === 404 || (data && !data.ok && (data.step === "employee" || data.error?.toLowerCase().includes("not found")))) {
    return (
      <Card data-testid="legitimacy-panel">
        <CardContent className="py-8 text-center text-muted-foreground">
          Employee not found
        </CardContent>
      </Card>
    );
  }

  if (!data?.ok || !data.legitimacy || !data.compliance) {
    return (
      <Card data-testid="legitimacy-panel">
        <CardContent className="py-8 text-center text-muted-foreground">
          {data?.error ?? "Unable to load legitimacy"}
        </CardContent>
      </Card>
    );
  }

  const { legitimacy, compliance, evidence } = data;
  const statusLabel = legitimacy.status;
  const illegalCount = compliance.illegal_count ?? 0;
  const warningCount = compliance.warning_count ?? 0;
  const nearestExpiry = compliance.nearest_expiry_date;
  const items = compliance.items ?? [];
  const illegalItems = evidence?.illegal_items ?? [];
  const warningItems = evidence?.warning_items ?? [];

  const statusVariant: "default" | "secondary" | "destructive" | "outline" =
    statusLabel === "GO" ? "default" : statusLabel === "RESTRICTED" ? "secondary" : statusLabel === "ILLEGAL" ? "destructive" : "outline";

  const StatusIcon = statusLabel === "GO" ? CheckCircle2 : statusLabel === "ILLEGAL" || statusLabel === "RESTRICTED" ? Ban : AlertTriangle;

  const visibleItems = tableOpen ? items : items.slice(0, INITIAL_ROWS);
  const hasMoreItems = items.length > INITIAL_ROWS;
  const visibleIllegal = evidenceOpen ? illegalItems : illegalItems.slice(0, INITIAL_EVIDENCE);
  const visibleWarning = evidenceOpen ? warningItems : warningItems.slice(0, INITIAL_EVIDENCE);
  const hasMoreEvidence = illegalItems.length > INITIAL_EVIDENCE || warningItems.length > INITIAL_EVIDENCE;

  return (
    <Card data-testid="legitimacy-panel">
      <CardHeader>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <StatusIcon className="h-6 w-6 text-muted-foreground" />
            <CardTitle className="text-lg">Legitimacy</CardTitle>
          </div>
          <Badge variant={statusVariant} className="text-sm font-semibold px-3 py-1">
            {statusLabel}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">As of {asOfDate}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <strong>Illegal:</strong> {illegalCount}
          </span>
          <span>
            <strong>Warning:</strong> {warningCount}
          </span>
          <span>
            <strong>Nearest expiry:</strong>{" "}
            {nearestExpiry ? new Date(nearestExpiry).toLocaleDateString("sv-SE") : "None"}
          </span>
        </div>

        {(illegalItems.length > 0 || warningItems.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Evidence</p>
            {illegalItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Illegal</p>
                <ul className="list-disc list-inside text-sm">
                  {visibleIllegal.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </div>
            )}
            {warningItems.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Warning</p>
                <ul className="list-disc list-inside text-sm">
                  {visibleWarning.map((code) => (
                    <li key={code}>{code}</li>
                  ))}
                </ul>
              </div>
            )}
            {hasMoreEvidence && (
              <Collapsible open={evidenceOpen} onOpenChange={setEvidenceOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 text-muted-foreground">
                    {evidenceOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                    Show all
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent />
              </Collapsible>
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-2">Compliance items</p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="w-28">Expiry date</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleItems.map((row) => (
                  <TableRow key={row.requirement_id}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.expiry_date ? new Date(row.expiry_date).toLocaleDateString("sv-SE") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.expiry_status === "ILLEGAL"
                            ? "destructive"
                            : row.expiry_status === "WARNING"
                              ? "outline"
                              : "secondary"
                        }
                        size="sm"
                      >
                        {row.expiry_status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {hasMoreItems && (
            <Collapsible open={tableOpen} onOpenChange={setTableOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-2 h-8 text-muted-foreground">
                  {tableOpen ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                  View all ({items.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent />
            </Collapsible>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
