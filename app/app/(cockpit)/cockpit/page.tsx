"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PriorityFixesWidget } from "@/components/cockpit/PriorityFixesWidget";
import { ActionsWidget } from "@/components/cockpit/ActionsWidget";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { StaffingWidget } from "@/components/cockpit/StaffingWidget";
import { useCockpitFilters } from "@/lib/CockpitFilterContext";
import { ComplianceWidget } from "@/components/cockpit/ComplianceWidget";
import { SafetyWidget } from "@/components/cockpit/SafetyWidget";
import { PlanActualWidget } from "@/components/cockpit/PlanActualWidget";
import { HandoverWidget } from "@/components/cockpit/HandoverWidget";
import { ActionDrawer } from "@/components/cockpit/ActionDrawer";
import { StaffingSuggestModal } from "@/components/cockpit/StaffingSuggestModal";
import { LineRootCauseDrawer } from "@/components/line-overview/LineRootCauseDrawer";
import { IssueTable } from "@/components/cockpit/IssueTable";
import { IssueDrawer } from "@/components/cockpit/IssueDrawer";
import { InterventionQueue } from "@/components/cockpit/InterventionQueue";
import type { CockpitIssueRow } from "@/app/api/cockpit/issues/route";
import { isDemoMode } from "@/lib/demoRuntime";
import {
  DEMO_ACTIONS,
  DEMO_COMPLIANCE,
  DEMO_SAFETY_OBSERVATIONS,
  DEMO_SHIFTS,
  DEMO_STATIONS,
  DEMO_EMPLOYEES_COCKPIT,
  getDemoStaffingCards,
  getDemoCockpitMetrics,
  getDemoPlanVsActual,
  getDemoPriorityItems,
  getDemoActivityLog,
  getDemoEmployeeSuggestions,
  getDemoHandoverItems,
} from "@/lib/cockpitDemo";
import type {
  Action,
  ComplianceItem,
  SafetyObservation,
  Shift,
  Station,
  StationStaffingCard,
  CockpitMetrics,
  PlanVsActual,
  PriorityItem,
  ActivityLogEntry,
  EmployeeSuggestion,
  HandoverItem,
} from "@/types/cockpit";
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";
import { cockpitSummaryParams, dateDaysAgo } from "@/lib/client/cockpitUrl";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";
import { PageFrame } from "@/components/layout/PageFrame";
import { aggregateRanges, formatSekRange, formatHoursRange, FRAGILITY_PTS } from "@/lib/cockpitCostEngine";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";

type GapsLineRow = {
  lineCode: string;
  lineName: string;
  gapHours: number;
  competenceStatus: "NO-GO" | "WARNING" | "OK";
  eligibleOperatorsCount: number;
  root_cause?: { primary: string; causes: string[] };
  stations: Array<{ stationId: string; stationCode: string; stationName: string; requiredHours: number; assignedHours: number; gapHours: number }>;
  missing_skill_codes: string[];
  recommended_action: "assign" | "call_in" | "swap";
};

function CockpitSkeleton() {
  return (
    <PageFrame>
      <div className="animate-pulse">
        <div className="h-8 w-48 bg-muted rounded mb-2 ds-h1" />
        <div className="h-4 w-32 bg-muted rounded mb-6 ds-meta" />
        <div className="h-32 bg-muted rounded-[var(--ds-radius-card)] mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-[var(--ds-radius-card)]" />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 h-64 bg-muted rounded-[var(--ds-radius-card)]" />
          <div className="col-span-8 h-64 bg-muted rounded-[var(--ds-radius-card)]" />
        </div>
      </div>
    </PageFrame>
  );
}

export default function CockpitPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { date, shiftType, line, setDate, setShiftType, setLine } = useCockpitFilters();
  const [isDemo, setIsDemo] = useState(false);
  const [autoSelectedDate, setAutoSelectedDate] = useState<string | null>(null);
  const [fallbackSearchDone, setFallbackSearchDone] = useState(false);
  const [fallbackSearching, setFallbackSearching] = useState(false);
  const [fallbackRetryKey, setFallbackRetryKey] = useState(0);
  const [lastFallbackDate, setLastFallbackDate] = useState<string | null>(null);
  const urlSyncedRef = useRef(false);
  const [availableShiftCodes, setAvailableShiftCodes] = useState<string[]>([]);

  const [actions, setActions] = useState<Action[]>([]);
  const [staffingCards, setStaffingCards] = useState<StationStaffingCard[]>([]);
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [safetyObservations, setSafetyObservations] = useState<SafetyObservation[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [metrics, setMetrics] = useState<CockpitMetrics | null>(null);
  const [planVsActual, setPlanVsActual] = useState<PlanVsActual[]>([]);
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [handoverData, setHandoverData] = useState<{ openLoops: HandoverItem[]; decisions: HandoverItem[]; risks: HandoverItem[] }>({ openLoops: [], decisions: [], risks: [] });
  const [loading, setLoading] = useState(true);

  const [selectedAction, setSelectedAction] = useState<Action | null>(null);
  const [actionDrawerOpen, setActionDrawerOpen] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);

  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<EmployeeSuggestion[]>([]);
  const [availableLines, setAvailableLines] = useState<string[]>([]);

  const [summary, setSummary] = useState<CockpitSummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [gapsLines, setGapsLines] = useState<GapsLineRow[]>([]);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [rootCauseDrawerLine, setRootCauseDrawerLine] = useState<GapsLineRow | null>(null);

  const [issues, setIssues] = useState<CockpitIssueRow[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<CockpitIssueRow | null>(null);
  const [issueDrawerOpen, setIssueDrawerOpen] = useState(false);
  const [issuesRefreshKey, setIssuesRefreshKey] = useState(0);
  const [showResolved, setShowResolved] = useState(false);
  const [lastResolvedIssue, setLastResolvedIssue] = useState<CockpitIssueRow | null>(null);
  const [undoUntil, setUndoUntil] = useState<number>(0);
  const [undoSecondsLeft, setUndoSecondsLeft] = useState(0);
  const [markedPlannedIds, setMarkedPlannedIds] = useState<Set<string>>(new Set());

  // Only query params: date, shift_code, optional line, optional show_resolved=1. Default show_resolved OFF.
  const summaryParams = (() => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    p.set("shift_code", shiftType);
    if (line && line !== "all") p.set("line", line);
    if (showResolved) p.set("show_resolved", "1");
    return p;
  })();
  const issuesParams = (() => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    p.set("shift_code", shiftType);
    if (line && line !== "all") p.set("line", line);
    if (showResolved) p.set("show_resolved", "1");
    return p;
  })();
  const summaryUrl = `/api/cockpit/summary?${summaryParams.toString()}`;
  const issuesUrl = `/api/cockpit/issues?${issuesParams.toString()}`;

  // URL sync: read date, shift_code, line from URL on mount
  useEffect(() => {
    if (urlSyncedRef.current) return;
    const qDate = searchParams.get("date")?.trim();
    const qShift = searchParams.get("shift_code")?.trim();
    const qLine = searchParams.get("line")?.trim();
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) setDate(qDate);
    if (qShift) setShiftType(qShift);
    if (qLine != null) setLine(qLine === "" || qLine === "all" ? "all" : qLine);
    urlSyncedRef.current = true;
  }, [searchParams, setDate, setShiftType, setLine]);

  // URL sync: push date, shift_code, line to URL when they change
  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", date);
    p.set("shift_code", shiftType);
    p.set("line", line);
    const next = p.toString();
    const current = searchParams.toString();
    if (next !== current) router.replace(`/app/cockpit?${next}`, { scroll: false });
  }, [date, shiftType, line, router, searchParams]);

  // Clear auto-selected label and fallback date when user changes date
  useEffect(() => {
    if (autoSelectedDate != null && date !== autoSelectedDate) setAutoSelectedDate(null);
    if (lastFallbackDate != null && date !== lastFallbackDate) setLastFallbackDate(null);
  }, [date, autoSelectedDate, lastFallbackDate]);

  // P1.3: Undo countdown (30s)
  useEffect(() => {
    if (!lastResolvedIssue || undoUntil <= 0) return;
    const tick = () => {
      const now = Date.now();
      if (now >= undoUntil) {
        setLastResolvedIssue(null);
        setUndoUntil(0);
        setUndoSecondsLeft(0);
        return;
      }
      setUndoSecondsLeft(Math.ceil((undoUntil - now) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastResolvedIssue, undoUntil]);

  // Load cockpit summary (date, shift_code, optional line)
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    fetchJson<CockpitSummaryResponse>(summaryUrl)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setSummaryError(friendly);
          setPageError(friendly);
          throw new Error(friendly);
        }
        return res.data;
      })
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setSummaryError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSummaryError(err instanceof Error ? err.message : "Unable to load summary");
          setSummary(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => { cancelled = true; };
  }, [summaryUrl, toast]);

  // P1.1: If current date has no issues, search backward up to 14 days for most recent date with data
  const fallbackKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isDemoMode() || summaryLoading || summary == null) return;
    if (summary.active_total > 0) {
      setFallbackSearchDone(false);
      return;
    }
    if (date === lastFallbackDate) return;
    const key = `${date}-${shiftType}-${line}`;
    if (fallbackKeyRef.current === key) return;
    fallbackKeyRef.current = key;
    setFallbackSearching(true);
    let cancelled = false;
    const searchBack = async (fromDate: string, daysLeft: number): Promise<string | null> => {
      for (let i = 1; i <= daysLeft; i++) {
        if (cancelled) return null;
        const d = dateDaysAgo(fromDate, i);
        const res = await fetchJson<CockpitSummaryResponse>(
          `/api/cockpit/summary?${cockpitSummaryParams({
            date: d,
            shift_code: shiftType,
            line: line === "all" ? undefined : line,
            show_resolved: showResolved,
          }).toString()}`
        );
        if (!cancelled && res.ok && res.data && res.data.active_total > 0) return d;
      }
      return null;
    };
    searchBack(date, 14).then((found) => {
      if (cancelled) return;
      setFallbackSearching(false);
      if (found != null) {
        setDate(found);
        setAutoSelectedDate(found);
        setLastFallbackDate(found);
      } else {
        setFallbackSearchDone(true);
      }
    });
    return () => { cancelled = true; };
  }, [date, shiftType, line, showResolved, summary, summaryLoading, setDate, fallbackRetryKey, lastFallbackDate]);

  // Load Tomorrow's Gaps (top risks) for same date/shift — same engine as Tomorrow's Gaps page
  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    setGapsLoading(true);
    const params = new URLSearchParams({ date, shift: shiftType.toLowerCase() });
    fetchJson<{ lines?: GapsLineRow[] }>(`/api/tomorrows-gaps?${params.toString()}`)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          const toastMessage =
            res.status === 401
              ? "Request failed (401) — Session expired. Please reload/login."
              : `Request failed (${res.status}) — ${res.error}`;
          toast({ title: toastMessage, variant: "destructive" });
          setPageError(friendly);
          throw new Error(friendly);
        }
        return res.data;
      })
      .then((data) => {
        if (!cancelled) setGapsLines(data.lines ?? []);
      })
      .catch(() => {
        if (!cancelled) setGapsLines([]);
      })
      .finally(() => {
        if (!cancelled) setGapsLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, shiftType, toast]);

  // Load Issue Inbox (date, shift_code, optional line)
  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    setIssuesLoading(true);
    setIssuesError(null);
    fetchJson<{ ok: boolean; issues?: CockpitIssueRow[] }>(issuesUrl)
      .then((res) => {
        if (!res.ok) {
          const friendly = res.status === 401 ? "Invalid or expired session" : res.error;
          toast({ title: friendly, variant: "destructive" });
          setIssuesError(friendly);
          throw new Error(friendly);
        }
        return res.data;
      })
      .then((data) => {
        if (!cancelled) setIssues(data.issues ?? []);
      })
      .catch((err) => {
        if (!cancelled) {
          setIssuesError(err instanceof Error ? err.message : "Unable to load issues");
          setIssues([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIssuesLoading(false);
      });
    return () => { cancelled = true; };
  }, [issuesUrl, toast, issuesRefreshKey]);


  const topRisks = gapsLines
    .filter((l) => l.competenceStatus === "NO-GO" || l.competenceStatus === "WARNING")
    .sort((a, b) => {
      if (a.competenceStatus !== b.competenceStatus) return a.competenceStatus === "NO-GO" ? -1 : 1;
      return b.gapHours - a.gapHours;
    })
    .slice(0, 5);

  // Load shift codes for selected date (DB-driven; S1, S2, Day, etc.)
  useEffect(() => {
    if (isDemoMode()) return;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setAvailableShiftCodes([]);
      return;
    }
    const url = `/api/cockpit/shift-codes?date=${encodeURIComponent(date)}`;
    fetchJson<{ ok?: boolean; shift_codes?: string[] }>(url)
      .then((res) => {
        if (!res.ok || !res.data?.shift_codes) {
          setAvailableShiftCodes([]);
          return;
        }
        const codes = res.data.shift_codes;
        setAvailableShiftCodes(codes);
        const inList = codes.length > 0 && codes.includes(shiftType);
        if (!inList && codes.length > 0) {
          const first = codes.includes("S1") ? "S1" : codes[0];
          setShiftType(first);
        }
      })
      .catch(() => setAvailableShiftCodes([]));
  }, [date]);

  // When shift_codes loaded, ensure current shift is in list; otherwise pick first (prefer S1)
  useEffect(() => {
    if (availableShiftCodes.length === 0) return;
    if (availableShiftCodes.includes(shiftType)) return;
    const first = availableShiftCodes.includes("S1") ? "S1" : availableShiftCodes[0];
    setShiftType(first);
  }, [availableShiftCodes, shiftType, setShiftType]);

  // Load line options from v_cockpit_station_summary.area for selected date+shift (no legacy codes)
  useEffect(() => {
    if (isDemoMode()) return;
    const p = new URLSearchParams({ date, shift_code: shiftType });
    const url = `/api/cockpit/lines?${p.toString()}`;
    fetchJson<{ lines?: string[] }>(url)
      .then((res) => {
        if (!res.ok) return;
        setAvailableLines(res.data.lines ?? []);
        if ("source" in res.data && res.data.source) console.debug("[cockpit lines] source:", res.data.source);
      })
      .catch((err) => console.error("[cockpit lines]", err));
  }, [date, shiftType]);

  useEffect(() => {
    const demo = isDemoMode();
    setIsDemo(demo);
    
    if (demo) {
      setTimeout(() => {
        setActions(DEMO_ACTIONS.filter(a => a.status === "open"));
        setStaffingCards(getDemoStaffingCards());
        setComplianceItems(DEMO_COMPLIANCE.filter(c => c.status === "expired" || c.status === "expiring_soon"));
        setSafetyObservations(DEMO_SAFETY_OBSERVATIONS);
        setShifts(DEMO_SHIFTS);
        setMetrics(getDemoCockpitMetrics());
        setPlanVsActual(getDemoPlanVsActual());
        setPriorityItems(getDemoPriorityItems());
        setHandoverData(getDemoHandoverItems());
        setLoading(false);
      }, 300);
    } else {
      setLoading(false);
    }
  }, []);

  const openActionDrawer = (action: Action) => {
    setSelectedAction(action);
    setActivityLog(getDemoActivityLog(action.id));
    setActionDrawerOpen(true);
  };

  const handleMarkActionDone = (actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId));
    setPriorityItems(prev => prev.filter(p => p.actionId !== actionId));
    setActionDrawerOpen(false);
    toast({ title: "Action completed", description: "The action has been marked as done." });
  };

  const handleReassign = (actionId: string, newOwnerId: string, newOwnerName: string) => {
    setActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, ownerId: newOwnerId, ownerName: newOwnerName } : a
    ));
    setActivityLog(prev => [{
      id: `log-${Date.now()}`,
      actionId,
      type: "reassigned",
      description: `Reassigned to ${newOwnerName}`,
      userName: "You",
      createdAt: new Date().toISOString(),
    }, ...prev]);
    toast({ title: "Action reassigned", description: `Assigned to ${newOwnerName}` });
  };

  const handleChangeDueDate = (actionId: string, newDate: string) => {
    setActions(prev => prev.map(a => 
      a.id === actionId ? { ...a, dueDate: newDate } : a
    ));
    setActivityLog(prev => [{
      id: `log-${Date.now()}`,
      actionId,
      type: "due_date_changed",
      description: `Due date changed to ${format(new Date(newDate), "MMM d, yyyy")}`,
      userName: "You",
      createdAt: new Date().toISOString(),
    }, ...prev]);
    toast({ title: "Due date updated" });
  };

  const handleResolvePriority = (item: PriorityItem) => {
    const action = actions.find(a => 
      (item.type === 'staffing' && a.relatedStationId === item.linkedEntity?.id) ||
      (item.type === 'compliance' && a.relatedEmployeeId === item.linkedEntity?.id) ||
      (item.type === 'safety' && a.id === item.actionId)
    );
    
    if (action) {
      openActionDrawer(action);
    } else if (item.type === 'staffing' && item.linkedEntity) {
      const station = DEMO_STATIONS.find(s => s.id === item.linkedEntity?.id);
      if (station) {
        handleSuggestReplacement(station.id);
      }
    } else {
      toast({ title: "Opening resolution...", description: item.title });
    }
  };

  const handleSuggestReplacement = (stationId: string) => {
    const station = DEMO_STATIONS.find(s => s.id === stationId);
    if (station) {
      setSelectedStation(station);
      setSuggestions(getDemoEmployeeSuggestions(stationId));
      setSuggestModalOpen(true);
    }
  };

  const handleApplySuggestion = (stationId: string, employeeId: string, employeeName: string) => {
    setStaffingCards(prev => prev.map(card => {
      if (card.station.id === stationId) {
        return {
          ...card,
          assignment: card.assignment ? { ...card.assignment, employeeId, employeeName, status: "assigned" as const } : undefined,
          employee: { id: employeeId, name: employeeName },
          complianceStatus: "green" as const,
        };
      }
      return card;
    }));
    setPriorityItems(prev => prev.filter(p => p.linkedEntity?.id !== stationId || p.type !== 'staffing'));
    setSuggestModalOpen(false);
    toast({ title: "Assignment updated", description: `${employeeName} assigned to ${selectedStation?.name}` });
  };

  const handleCreateComplianceAction = (item: ComplianceItem) => {
    toast({ title: "Action created", description: `Renewal action created for ${item.employeeName}'s ${item.title}` });
  };

  const handleCreateObservation = () => {
    toast({ title: "Report observation", description: "Safety observation form would open here." });
  };

  const handleGenerateHandover = () => {
    toast({ title: "Handover report generated", description: "PDF ready for download" });
  };

  const handleIssueRowClick = (row: CockpitIssueRow) => {
    setSelectedIssue(row);
    setIssueDrawerOpen(true);
  };

  const handleIssueDecision = async (action: "acknowledged" | "plan_training" | "swap" | "escalate") => {
    if (!selectedIssue?.station_id) return;
    const snapshot = selectedIssue;
    setIssues((prev) => prev.filter((i) => i.issue_id !== snapshot.issue_id));
    setIssueDrawerOpen(false);
    setSelectedIssue(null);
    const until = Date.now() + 30_000;
    setLastResolvedIssue(snapshot);
    setUndoUntil(until);
    setUndoSecondsLeft(30);
    const issueType = snapshot.issue_type ?? (snapshot.severity === "BLOCKING" ? "NO_GO" : "WARNING");
    const res = await fetchJson<{ ok: boolean }>("/api/cockpit/issues/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date,
        shift_code: snapshot.shift_code,
        station_id: snapshot.station_id,
        issue_type: issueType,
        action,
      }),
    });
    if (!res.ok) {
      setIssues((prev) => [...prev, snapshot].sort((a, b) => (a.issue_id < b.issue_id ? -1 : 1)));
      setLastResolvedIssue(null);
      setUndoUntil(0);
      toast({ title: res.error ?? "Failed to save decision", variant: "destructive" });
      return;
    }
  };

  const handleResolveUndo = () => {
    if (!lastResolvedIssue) return;
    setIssues((prev) => [...prev, lastResolvedIssue].sort((a, b) => (a.issue_id < b.issue_id ? -1 : 1)));
    setLastResolvedIssue(null);
    setUndoUntil(0);
    setUndoSecondsLeft(0);
    toast({ title: "Undo restored in UI; refresh to confirm." });
  };

  const dateLabel = format(new Date(date + "T12:00:00"), "EEEE, MMMM d, yyyy");

  // Fragility Index 0–100 from severity (BLOCKING = 25 pts, WARNING = 8 pts). UI-only, no backend.
  const blockingCount = summary?.active_blocking ?? issues.filter((i) => !i.resolved && i.severity === "BLOCKING").length;
  const warningCount = summary?.active_nonblocking ?? issues.filter((i) => !i.resolved && i.severity === "WARNING").length;
  const fragilityBlockingPts = blockingCount * 25;
  const fragilityWarningPts = warningCount * 8;
  const fragilityIndex = Math.min(100, fragilityBlockingPts + fragilityWarningPts);

  // Management Brief (current view only; UI-only heuristics, range aggregation)
  const resolvedIssues = issues.filter((i) => i.resolved);
  const openIssues = issues.filter((i) => !i.resolved);
  const mitigatedIssues = resolvedIssues.filter((i) => !i.decision_actions?.includes?.("acknowledged"));
  const acceptedRiskIssues = resolvedIssues.filter((i) => i.decision_actions?.includes?.("acknowledged"));
  const hasClosed = resolvedIssues.length > 0;
  const hasOpen = openIssues.length > 0;
  const showManagementBrief = issues.length >= 1;

  const openRanges = aggregateRanges(openIssues.map((i) => i.severity));
  const openFragilityExposure = openIssues.reduce((s, i) => s + FRAGILITY_PTS[i.severity], 0);
  const avoidedRanges = aggregateRanges(mitigatedIssues.map((i) => i.severity));
  const deferredRanges = aggregateRanges(acceptedRiskIssues.map((i) => i.severity));
  const netFragilityDelta = resolvedIssues.reduce((s, i) => s + FRAGILITY_PTS[i.severity], 0);

  const filteredStaffingCards = line === "all"
    ? staffingCards
    : staffingCards.filter((c) => c.station.line === line);

  // Line options from /api/cockpit/lines only; exclude any legacy display names
  const lineOptions = availableLines.filter((l) => !isLegacyLine(l));

  if (pageError) {
    return (
      <PageFrame>
        <EmptyState headline="Something went wrong" description={pageError} action={<Button onClick={() => window.location.reload()}>Reload</Button>} />
      </PageFrame>
    );
  }

  if (loading) {
    return <CockpitSkeleton />;
  }

  const filterBar = (
    <>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 px-2 rounded-sm border border-input bg-background cockpit-body"
            data-testid="input-date"
          />
          <Select value={shiftType} onValueChange={(v) => setShiftType(v)}>
            <SelectTrigger className="h-8 w-[110px] px-2 text-[13px]" data-testid="select-shift">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {(availableShiftCodes.length ? availableShiftCodes : shiftType ? [shiftType] : []).map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={line} onValueChange={setLine}>
            <SelectTrigger className="h-8 w-[110px] px-2 text-[13px]" data-testid="select-line">
              <SelectValue placeholder="Line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Lines</SelectItem>
              {lineOptions.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-1.5 cockpit-body cursor-pointer ml-2">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded-sm border-input"
              data-testid="cockpit-show-resolved"
            />
            Show resolved
          </label>
        </div>
        <div className="flex items-center gap-3">
          {!summaryLoading && summary != null && (
            <span className="cockpit-label cockpit-num" data-testid="cockpit-active-count">
              Open decisions: {summary.active_total}
            </span>
          )}
          {!isDemoMode() && (
            <div
              className="cockpit-card-primary flex items-baseline gap-2 px-3 py-2"
              title={`Blocking: ${blockingCount} × 25 = ${fragilityBlockingPts} · Warnings: ${warningCount} × 8 = ${fragilityWarningPts}`}
              data-testid="fragility-index"
            >
              <span className="cockpit-label">Fragility Index</span>
              <span className="cockpit-num text-[1.75rem] font-semibold" style={{ color: "hsl(var(--foreground))" }}>{fragilityIndex}</span>
            </div>
          )}
        </div>
      </header>
    </>
  );

  const debugPanel = (
    <div data-testid="cockpit-debug-panel">
      <p className="font-semibold text-muted-foreground mb-1">Debug (dev only)</p>
      <p><span className="text-muted-foreground">Summary:</span> {typeof window !== "undefined" ? `${window.location.origin}${summaryUrl}` : summaryUrl}</p>
      <p><span className="text-muted-foreground">Decisions API:</span> {typeof window !== "undefined" ? `${window.location.origin}${issuesUrl}` : issuesUrl}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2"
        onClick={() => {
          const full = typeof window !== "undefined" ? `${window.location.origin}${issuesUrl}` : issuesUrl;
          void navigator.clipboard.writeText(full);
          toast({ title: "Copied decisions API URL" });
        }}
      >
        Copy decisions API URL
      </Button>
    </div>
  );

  return (
    <PageFrame filterBar={filterBar} debugPanel={debugPanel}>
      {summary && summary.active_total === 0 && !summaryLoading && !fallbackSearching && fallbackSearchDone && (
        <div className="cockpit-card-secondary mb-4 px-3 py-2 flex flex-wrap items-center justify-between gap-3" data-testid="cockpit-empty-state">
          <span className="cockpit-body text-muted-foreground">No decisions</span>
          <div className="flex flex-wrap items-center gap-2">
            {(availableShiftCodes.length ? availableShiftCodes : ["Day", "Evening", "Night"]).map((s) => (
              <Button key={s} variant="outline" size="sm" className="h-7 text-[13px]" onClick={() => setShiftType(s)} data-testid={`empty-shift-${s}`}>
                {s}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[13px]"
              onClick={() => {
                setFallbackSearchDone(false);
                fallbackKeyRef.current = null;
                setFallbackRetryKey((k) => k + 1);
              }}
              data-testid="empty-jump-latest"
            >
              Jump to latest
            </Button>
          </div>
        </div>
      )}

      {lastResolvedIssue != null && undoUntil > 0 && (() => {
        const pts = lastResolvedIssue.severity === "BLOCKING" ? 25 : 8;
        return (
          <div className="cockpit-card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-l-[3px] border-l-[hsl(var(--ds-status-ok-text))]" data-testid="cockpit-resolve-undo-bar">
            <div className="flex flex-wrap items-center gap-3 cockpit-body">
              <span className="cockpit-status-ok font-medium">Decision recorded.</span>
              <span className="cockpit-num">Fragility Δ −{pts}</span>
              <span className="cockpit-num">Undo ({undoSecondsLeft}s)</span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[13px]" onClick={handleResolveUndo} data-testid="cockpit-resolve-undo-btn">
              Undo
            </Button>
          </div>
        );
      })()}

      {!isDemoMode() && showManagementBrief && (
        <div className="cockpit-card-primary mb-4 p-5" data-testid="management-brief">
          <p className="cockpit-title font-semibold mb-4">Management Brief</p>
          {!hasClosed && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="cockpit-num text-[1.125rem] font-semibold">{formatSekRange(openRanges.costMin, openRanges.costMax)}</p>
                <p className="cockpit-label mt-0.5">Cost</p>
              </div>
              <div>
                <p className="cockpit-num text-[1.125rem] font-semibold">{formatHoursRange(openRanges.hoursMin, openRanges.hoursMax)}</p>
                <p className="cockpit-label mt-0.5">Time</p>
              </div>
              <div>
                <p className="cockpit-num text-[1.125rem] font-semibold">{openFragilityExposure}</p>
                <p className="cockpit-label mt-0.5">Fragility</p>
              </div>
            </div>
          )}
          {hasClosed && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-ok">
                    {formatSekRange(avoidedRanges.costMin, avoidedRanges.costMax)}
                  </p>
                  <p className="cockpit-label mt-0.5">Cost avoided</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-at-risk">
                    {formatSekRange(deferredRanges.costMin, deferredRanges.costMax)}
                  </p>
                  <p className="cockpit-label mt-0.5">Cost deferred</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-ok">
                    {formatHoursRange(avoidedRanges.hoursMin, avoidedRanges.hoursMax)}
                  </p>
                  <p className="cockpit-label mt-0.5">Time saved</p>
                </div>
                <div>
                  <p className="cockpit-num text-[1.125rem] font-semibold cockpit-status-at-risk">
                    {formatHoursRange(deferredRanges.hoursMin, deferredRanges.hoursMax)}
                  </p>
                  <p className="cockpit-label mt-0.5">Time deferred</p>
                </div>
              </div>
              {hasOpen && (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-baseline gap-4 cockpit-body cockpit-num">
                  <span>{formatSekRange(openRanges.costMin, openRanges.costMax)}</span>
                  <span>{formatHoursRange(openRanges.hoursMin, openRanges.hoursMax)}</span>
                  <span>Fragility {openFragilityExposure}</span>
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-4 mt-4 pt-4 border-t border-border cockpit-body cockpit-num text-muted-foreground">
                <span>Accepted: <span className="font-medium text-foreground">{acceptedRiskIssues.length}</span></span>
                <span>Net Δ <span className="font-medium cockpit-status-ok">−{netFragilityDelta}</span></span>
              </div>
            </>
          )}
        </div>
      )}

      <div className="mb-5">
        <PriorityFixesWidget
          items={priorityItems}
          onResolve={handleResolvePriority}
          summary={summary}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          date={date}
          shiftType={shiftType}
        />
      </div>

      {!isDemoMode() && (
        <div className="mb-5">
          <InterventionQueue
            issues={issues}
            markedPlannedIds={markedPlannedIds}
            currentFragility={fragilityIndex}
            onMarkPlanned={(issueId) => setMarkedPlannedIds((prev) => {
              const next = new Set(prev);
              if (next.has(issueId)) next.delete(issueId);
              else next.add(issueId);
              return next;
            })}
            onViewDecision={(issue) => {
              setSelectedIssue(issue);
              setIssueDrawerOpen(true);
            }}
          />
          <SectionHeader title="Decision queue" description={issues.length > 0 ? String(issues.length) : undefined} className="mb-2 mt-1" />
          <IssueTable
            issues={issues}
            loading={issuesLoading}
            error={issuesError}
            onRowClick={handleIssueRowClick}
          />
        </div>
      )}

      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-6 pt-4 border-t border-border">
          <div className="cockpit-card-secondary px-3 py-2">
            <p className="cockpit-label">Open actions</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="cockpit-title cockpit-num">{metrics.openActions}</p>
              {metrics.criticalActions > 0 && (
                <span className="cockpit-label cockpit-status-blocking">{metrics.criticalActions} critical</span>
              )}
            </div>
          </div>
          <div className="cockpit-card-secondary px-3 py-2">
            <p className="cockpit-label">Staffing</p>
            <div className="flex items-baseline gap-1 mt-0.5 cockpit-num">
              <p className="cockpit-title">{metrics.staffedStations}</p>
              <p className="cockpit-body text-muted-foreground">/ {metrics.totalStations}</p>
            </div>
          </div>
          <div className="cockpit-card-secondary px-3 py-2">
            <p className="cockpit-label">Compliance</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <p className="cockpit-title cockpit-num cockpit-status-at-risk">{metrics.expiringCompliance + metrics.overdueCompliance}</p>
              <span className="cockpit-label">{metrics.overdueCompliance} overdue</span>
            </div>
          </div>
          <div className="cockpit-card-secondary px-3 py-2">
            <p className="cockpit-label">Safety</p>
            <div className="flex items-baseline gap-2 mt-0.5 cockpit-num">
              <p className="cockpit-title">{metrics.safetyObservationsThisWeek}</p>
              <span className="cockpit-label">this week</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-4 mt-2">
        <div className="lg:col-span-4 space-y-4 lg:space-y-6">
          <ActionsWidget
            actions={actions}
            onMarkDone={handleMarkActionDone}
            onActionClick={openActionDrawer}
            summary={summary}
            summaryLoading={summaryLoading}
            summaryError={summaryError}
          />
          <HandoverWidget
            openLoops={handoverData.openLoops}
            decisions={handoverData.decisions}
            risks={handoverData.risks}
            onGenerateHandover={handleGenerateHandover}
          />
        </div>

        <div className="lg:col-span-8 space-y-4 lg:space-y-6">
          <StaffingWidget
            staffingCards={filteredStaffingCards}
            onSuggestReplacement={handleSuggestReplacement}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ComplianceWidget
              items={complianceItems}
              onCreateAction={handleCreateComplianceAction}
            />
            <SafetyWidget
              observations={safetyObservations}
              openActionsCount={metrics?.openSafetyActions || 0}
              onCreateObservation={handleCreateObservation}
            />
            <PlanActualWidget data={planVsActual} />
          </div>
        </div>
      </div>

      <ActionDrawer
        action={selectedAction}
        open={actionDrawerOpen}
        onClose={() => setActionDrawerOpen(false)}
        onMarkDone={handleMarkActionDone}
        onReassign={handleReassign}
        onChangeDueDate={handleChangeDueDate}
        activityLog={activityLog}
        availableOwners={DEMO_EMPLOYEES_COCKPIT}
      />

      <StaffingSuggestModal
        station={selectedStation}
        open={suggestModalOpen}
        onClose={() => setSuggestModalOpen(false)}
        suggestions={suggestions}
        onApply={handleApplySuggestion}
      />

      <LineRootCauseDrawer
        open={rootCauseDrawerLine !== null}
        onOpenChange={(open) => !open && setRootCauseDrawerLine(null)}
        line={rootCauseDrawerLine}
        date={date}
        shift={shiftType}
      />

      <IssueDrawer
        open={issueDrawerOpen}
        onOpenChange={setIssueDrawerOpen}
        issue={selectedIssue}
        onAcknowledge={() => handleIssueDecision("acknowledged")}
        onPlanTraining={() => handleIssueDecision("plan_training")}
        onSwap={() => handleIssueDecision("swap")}
        onEscalate={() => handleIssueDecision("escalate")}
        isAcknowledged={selectedIssue?.resolved ?? false}
      />
    </PageFrame>
  );
}
