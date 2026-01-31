"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Factory,
  Gauge,
  Percent,
  Plus,
  Users,
  Zap,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import {
  fetchLineOverviewDataResult,
  fetchWeekOverviewDataResult,
  mapLineOverviewApiData,
  mapWeekOverviewApiData,
} from "@/services/lineOverview";
import type { LineOverviewData, MachineWithData, ShiftType } from "@/types/lineOverview";
import { MachineCard } from "@/components/line-overview/MachineCard";
import { AssignmentDrawer } from "@/components/line-overview/AssignmentDrawer";
import { SuggestModal } from "@/components/line-overview/SuggestModal";
import { DemandModal } from "@/components/line-overview/DemandModal";
import { useOrg } from "@/hooks/useOrg";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";

type ViewMode = "day" | "week";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today as YYYY-MM-DD in UTC (for default when no date param). */
function todayYMDUTC(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize weekend to next Monday (workday). UTC-safe YMD parsing.
 * Sat -> next Mon, Sun -> next Mon. Returns YYYY-MM-DD.
 */
function normalizeToWorkday(ymd: string | null): string {
  if (!ymd || !YMD_RE.test(ymd)) return todayYMDUTC();
  const [, y, m, d] = ymd.match(YMD_RE)!;
  const year = parseInt(y!, 10);
  const month = parseInt(m!, 10) - 1;
  const day = parseInt(d!, 10);
  const utc = Date.UTC(year, month, day);
  const date = new Date(utc);
  const dow = date.getUTCDay();
  if (dow === 0) {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (dow === 6) {
    date.setUTCDate(date.getUTCDate() + 2);
  }
  const oy = date.getUTCFullYear();
  const om = String(date.getUTCMonth() + 1).padStart(2, "0");
  const od = String(date.getUTCDate()).padStart(2, "0");
  return `${oy}-${om}-${od}`;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseShiftParam(value: string | null): ShiftType | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "day") return "Day";
  if (normalized === "evening") return "Evening";
  if (normalized === "night") return "Night";
  return null;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export default function LineOverviewPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsString = searchParams.toString();
  const { currentRole } = useOrg();
  const { toast } = useToast();

  const rawDate = searchParams.get("date") || todayYMDUTC();
  const canonicalDateStr = useMemo(() => normalizeToWorkday(rawDate), [rawDate]);
  const selectedDate = useMemo(
    () => new Date(`${canonicalDateStr}T12:00:00Z`),
    [canonicalDateStr]
  );

  const [shiftType, setShiftType] = useState<ShiftType>(() => parseShiftParam(searchParams.get("shift")) ?? "Day");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [data, setData] = useState<LineOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<string>>(new Set());
  const [selectedMachine, setSelectedMachine] = useState<MachineWithData | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [suggestMachine, setSuggestMachine] = useState<MachineWithData | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [demandMachine, setDemandMachine] = useState<MachineWithData | null>(null);
  const [demandOpen, setDemandOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState<string | null>(null);

  const isAdminOrHr = currentRole === "admin" || currentRole === "hr";

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = canonicalDateStr;
      let result: LineOverviewData;
      if (viewMode === "week") {
        const weekStart = getWeekStart(selectedDate);
        const response = await fetchWeekOverviewDataResult(formatDate(weekStart), shiftType);
        if (!response.ok) {
          const message = response.status === 401 ? "Invalid or expired session" : response.error;
          const toastMessage =
            response.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${response.status}) — ${response.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setError(message);
          setData(null);
          return;
        }
        result = mapWeekOverviewApiData(response.data);
      } else {
        const response = await fetchLineOverviewDataResult(dateStr, shiftType);
        if (!response.ok) {
          const message = response.status === 401 ? "Invalid or expired session" : response.error;
          const toastMessage =
            response.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${response.status}) — ${response.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setError(message);
          setData(null);
          return;
        }
        result = mapLineOverviewApiData(response.data);
      }
      setData(result);
      if (expandedLines.size === 0 && result.lines.length > 0) {
        setExpandedLines(new Set(result.lines.slice(0, 3).map((l) => l.line.lineCode)));
      }
    } catch (err) {
      console.error("Failed to load line overview:", err);
      const status =
        err && typeof err === "object" && "status" in err
          ? (err as { status?: number }).status
          : undefined;
      const message = err instanceof Error ? err.message : "Failed to load data";
      const friendly = status === 401 ? "Invalid or expired session" : message;
      const toastMessage =
        status === 401
          ? "Request failed (401) — Session expired. Please reload/login."
          : `Request failed (${status ?? "error"}) — ${message}`;
      toast({
        title: toastMessage,
        variant: "destructive",
      });
      setError(friendly);
    } finally {
      setLoading(false);
    }
  }, [canonicalDateStr, selectedDate, shiftType, viewMode, toast, expandedLines.size]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const shiftParam = parseShiftParam(searchParams.get("shift"));
    if (shiftParam != null && shiftParam !== shiftType) {
      setShiftType(shiftParam);
    }
  }, [paramsString, searchParams, shiftType]);

  useEffect(() => {
    if (rawDate !== canonicalDateStr) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", canonicalDateStr);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [paramsString, rawDate, canonicalDateStr, pathname, router, searchParams]);

  const handleDatePickerChange = useCallback(
    (ymd: string) => {
      const nextCanonical = normalizeToWorkday(ymd);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", nextCanonical);
      params.set("shift", shiftType);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, shiftType]
  );

  const handleShiftChange = useCallback(
    (v: ShiftType) => {
      setShiftType(v);
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", canonicalDateStr);
      params.set("shift", v);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams, canonicalDateStr]
  );

  const toggleLine = (lineCode: string) => {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineCode)) {
        next.delete(lineCode);
      } else {
        next.add(lineCode);
      }
      return next;
    });
  };

  const handleMachineClick = (machine: MachineWithData) => {
    setSelectedMachine(machine);
    setDrawerOpen(true);
  };

  const handleSuggestClick = (machine: MachineWithData) => {
    setSuggestMachine(machine);
    setSuggestOpen(true);
  };

  const handleDemandClick = (machine: MachineWithData) => {
    setDemandMachine(machine);
    setDemandOpen(true);
  };

  const handleAssignmentChange = () => {
    loadData();
  };

  const handleDemandChange = () => {
    loadData();
  };

  const handleGenerateDemand = useCallback(
    async (lineCode: string) => {
      setGenerateLoading(lineCode);
      try {
        const res = await fetch("/api/line-overview/demand/generate", {
          method: "POST",
          headers: withDevBearer({ "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({
            date: formatDate(selectedDate),
            shiftType,
            lineCode,
            hoursPerStation: 8,
          }),
        });
        const data = await res.json().catch(() => ({})) as { error?: string; stations_per_line?: Record<string, number> };
        if (!res.ok) {
          const msg = data?.error ?? "Unknown error";
          const detail = data?.stations_per_line
            ? ` Stations per line: ${JSON.stringify(data.stations_per_line)}`
            : "";
          toast({
            title: "Generate demand failed",
            description: msg + detail,
            variant: "destructive",
          });
          return;
        }
        const created = (data as { created?: number }).created ?? 0;
        const updated = (data as { updated?: number }).updated ?? 0;
        toast({
          title: "Demand generated",
          description:
            created > 0 || updated > 0
              ? `Created: ${created}, updated: ${updated} station(s).`
              : "No stations in this line (or already up to date).",
        });
        loadData();
      } finally {
        setGenerateLoading(null);
      }
    },
    [selectedDate, shiftType, toast, loadData]
  );

  const shiftOptions: ShiftType[] = ["Day", "Evening", "Night"];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Factory className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Line Overview</h1>
                <p className="text-sm text-muted-foreground">
                  Visualize staffing across all production lines
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={canonicalDateStr}
                  onChange={(e) => handleDatePickerChange(e.target.value)}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="input-date"
                />
              </div>

              <Select value={shiftType} onValueChange={(v) => handleShiftChange(v as ShiftType)}>
                <SelectTrigger className="w-[120px]" data-testid="select-shift">
                  <Clock className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shiftOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex rounded-lg border border-input overflow-hidden">
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === "day"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid="button-view-day"
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    viewMode === "week"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid="button-view-week"
                >
                  Week
                </button>
              </div>
            </div>
          </div>

          {data && !loading && (
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t">
              {data.metrics.hasDemand ? (
                <>
                  <MetricChip
                    icon={<Percent className="h-3.5 w-3.5" />}
                    label="Coverage"
                    value={`${data.metrics.coveragePercent}%`}
                    variant={(data.metrics.coveragePercent ?? 0) >= 90 ? "success" : (data.metrics.coveragePercent ?? 0) >= 70 ? "warning" : "danger"}
                  />
                  <MetricChip
                    icon={<AlertTriangle className="h-3.5 w-3.5" />}
                    label="Gap"
                    value={`${(data.metrics.totalGapHours ?? 0).toFixed(1)}h`}
                    variant={(data.metrics.totalGapHours ?? 0) === 0 ? "success" : (data.metrics.totalGapHours ?? 0) <= 8 ? "warning" : "danger"}
                  />
                </>
              ) : (
                <MetricChip
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                  label="Demand"
                  value="No demand"
                  variant="neutral"
                />
              )}
              {data.metrics.overAssignedHours > 0 && (
                <MetricChip
                  icon={<Zap className="h-3.5 w-3.5" />}
                  label="Over-assigned"
                  value={`+${data.metrics.overAssignedHours.toFixed(1)}h`}
                  variant="info"
                />
              )}
              <MetricChip
                icon={<Users className="h-3.5 w-3.5" />}
                label="Present"
                value={String(data.metrics.presentCount + data.metrics.partialCount)}
                variant="success"
              />
              <MetricChip
                icon={<Users className="h-3.5 w-3.5" />}
                label="Absent"
                value={String(data.metrics.absentCount)}
                variant={data.metrics.absentCount > 0 ? "warning" : "success"}
              />
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} className="h-40 rounded-lg" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>Reload</Button>
            </CardContent>
          </Card>
        ) : data?.lines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No lines found for this tenant. Import stations.</h3>
              <p className="text-muted-foreground">
                No production lines are configured for this organization.
              </p>
            </CardContent>
          </Card>
        ) : data && data.lines.every((line) => line.machines.every((m) => (m.requiredHours ?? 0) === 0)) ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No demand matched for {formatDate(selectedDate)} {shiftType} — generate demand template.
              </h3>
              <Button
                onClick={() => {
                  const lineCode = data.lines[0]?.line.lineCode;
                  if (lineCode) handleGenerateDemand(lineCode);
                }}
                disabled={!data.lines[0]?.line.lineCode || generateLoading !== null}
              >
                Generate demand template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.lines.map((lineData) => {
              const isExpanded = expandedLines.has(lineData.line.lineCode);
              const hasDemand = lineData.totalRequiredHours > 0;

              return (
                <Card key={lineData.line.lineCode} className="overflow-hidden">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleLine(lineData.line.lineCode)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleLine(lineData.line.lineCode);
                      }
                    }}
                    className="w-full text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-lg"
                    data-testid={`line-header-${lineData.line.lineCode}`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between py-3 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {lineData.line.lineName}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {lineData.line.lineCode} • {lineData.machines.length} machines
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                        {isAdminOrHr && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={generateLoading !== null}
                            onClick={() => handleGenerateDemand(lineData.line.lineCode)}
                            data-testid={`button-generate-demand-${lineData.line.lineCode}`}
                          >
                            {generateLoading === lineData.line.lineCode ? (
                              "Generating…"
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                Generate demo demand
                              </>
                            )}
                          </Button>
                        )}
                        {hasDemand ? (
                          <>
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                {lineData.totalAssignedHours.toFixed(1)}h /{" "}
                                {lineData.totalRequiredHours.toFixed(1)}h
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {lineData.totalGap > 0 ? (
                                  <span className="text-destructive">
                                    Gap: {lineData.totalGap.toFixed(1)}h
                                  </span>
                                ) : (
                                  <span className="text-green-600">Fully staffed</span>
                                )}
                              </p>
                            </div>
                            <Badge
                              variant="secondary"
                              className={`${
                                lineData.totalGap <= 0
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                  : lineData.totalGap <= 2
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                              }`}
                            >
                              {lineData.totalGap <= 0
                                ? "OK"
                                : lineData.totalGap <= 2
                                ? "Low Gap"
                                : "Gap"}
                            </Badge>
                          </>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            No demand
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                  </div>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      {!hasDemand ? (
                        <Card className="bg-muted/40 border-dashed" data-testid="line-overview-empty-demand">
                          <CardContent className="py-8 text-center">
                            <p className="text-sm text-muted-foreground mb-3">
                              No demand yet for {formatDate(selectedDate)} {shiftType} — generate a template to start planning.
                            </p>
                            {isAdminOrHr && (
                              <Button
                                size="sm"
                                disabled={generateLoading !== null}
                                onClick={() => handleGenerateDemand(lineData.line.lineCode)}
                                data-testid={`empty-generate-demand-${lineData.line.lineCode}`}
                              >
                                {generateLoading === lineData.line.lineCode ? (
                                  "Generating…"
                                ) : (
                                  <>
                                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                                    Generate demand
                                  </>
                                )}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ) : lineData.machines.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No machines in this line
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {lineData.machines.map((machineData) => (
                            <MachineCard
                              key={machineData.machine.stationId ?? machineData.machine.id ?? machineData.machine.machineCode}
                              data={machineData}
                              viewMode={viewMode}
                              onClick={() => handleMachineClick(machineData)}
                              onSuggest={() => handleSuggestClick(machineData)}
                              onImportDemand={() => handleDemandClick(machineData)}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AssignmentDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        machine={selectedMachine}
        planDate={formatDate(selectedDate)}
        shiftType={shiftType}
        employees={data?.employees || []}
        attendance={data?.attendance || []}
        onAssignmentChange={handleAssignmentChange}
      />

      <SuggestModal
        open={suggestOpen}
        onOpenChange={setSuggestOpen}
        machine={suggestMachine}
        planDate={formatDate(selectedDate)}
        shiftType={shiftType}
        onApply={handleAssignmentChange}
      />

      <DemandModal
        open={demandOpen}
        onOpenChange={setDemandOpen}
        machine={demandMachine}
        planDate={formatDate(selectedDate)}
        shiftType={shiftType}
        onDemandChange={handleDemandChange}
      />
    </div>
  );
}

function MetricChip({
  icon,
  label,
  value,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant: "success" | "warning" | "danger" | "neutral" | "info";
}) {
  const variantStyles = {
    success: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    neutral: "bg-muted text-muted-foreground",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  };

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${variantStyles[variant]}`}
    >
      {icon}
      <span>{label}:</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
