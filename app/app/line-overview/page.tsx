"use client";

import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { fetchLineOverviewData, fetchWeekOverviewData } from "@/services/lineOverview";
import type { LineOverviewData, MachineWithData, ShiftType } from "@/types/lineOverview";
import { MachineCard } from "@/components/line-overview/MachineCard";
import { AssignmentDrawer } from "@/components/line-overview/AssignmentDrawer";
import { SuggestModal } from "@/components/line-overview/SuggestModal";
import { DemandModal } from "@/components/line-overview/DemandModal";

type ViewMode = "day" | "week";

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d;
}

export default function LineOverviewPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [shiftType, setShiftType] = useState<ShiftType>("Day");
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dateStr = formatDate(selectedDate);
      let result: LineOverviewData;
      if (viewMode === "week") {
        const weekStart = getWeekStart(selectedDate);
        result = await fetchWeekOverviewData(formatDate(weekStart), shiftType);
      } else {
        result = await fetchLineOverviewData(dateStr, shiftType);
      }
      setData(result);
      if (expandedLines.size === 0 && result.lines.length > 0) {
        setExpandedLines(new Set(result.lines.slice(0, 3).map((l) => l.line.lineCode)));
      }
    } catch (err) {
      console.error("Failed to load line overview:", err);
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [selectedDate, shiftType, viewMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
                  value={formatDate(selectedDate)}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  data-testid="input-date"
                />
              </div>

              <Select value={shiftType} onValueChange={(v) => setShiftType(v as ShiftType)}>
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
              <Button onClick={loadData}>Retry</Button>
            </CardContent>
          </Card>
        ) : data?.lines.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No lines found</h3>
              <p className="text-muted-foreground">
                No production lines are configured for this organization.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.lines.map((lineData) => {
              const isExpanded = expandedLines.has(lineData.line.lineCode);
              const hasDemand = lineData.totalRequiredHours > 0;

              return (
                <Card key={lineData.line.lineCode} className="overflow-hidden">
                  <button
                    onClick={() => toggleLine(lineData.line.lineCode)}
                    className="w-full text-left"
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
                      <div className="flex items-center gap-4">
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
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      {lineData.machines.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No machines in this line
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {lineData.machines.map((machineData) => (
                            <MachineCard
                              key={machineData.machine.machineCode}
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
