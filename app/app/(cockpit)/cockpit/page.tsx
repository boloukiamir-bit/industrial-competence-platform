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
import { Button } from "@/components/ui/button";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { getInitialDateFromUrlOrToday, useCockpitFilters } from "@/lib/CockpitFilterContext";
import { useSessionHealth } from "@/lib/SessionHealthContext";
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

/** Drilldown from GET /api/cockpit/shift-legitimacy/[shiftId] */
type ShiftLegitimacyDrilldown = {
  shift_status: "GO" | "WARNING" | "ILLEGAL";
  blocking_employees: Array<{ id: string; name: string; reasons: string[] }>;
  warning_employees: Array<{ id: string; name: string; reasons: string[] }>;
};
import { useToast } from "@/hooks/use-toast";
import { fetchJson } from "@/lib/coreFetch";
import { cockpitSummaryParams, dateDaysAgo } from "@/lib/client/cockpitUrl";
import { isLegacyLine } from "@/lib/shared/isLegacyLine";
import { PageFrame } from "@/components/layout/PageFrame";
import { FRAGILITY_PTS } from "@/lib/cockpitCostEngine";
import { EmptyState } from "@/components/ui/empty-state";

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
        <div className="h-8 w-48 rounded mb-2" style={{ background: "var(--surface-3, #F2F4F7)" }} />
        <div className="h-4 w-32 rounded mb-6" style={{ background: "var(--surface-3, #F2F4F7)" }} />
        <div className="h-32 rounded-sm mb-6" style={{ background: "var(--surface-3, #F2F4F7)" }} />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-sm" style={{ background: "var(--surface-3, #F2F4F7)" }} />
          ))}
        </div>
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 h-64 rounded-sm" style={{ background: "var(--surface-3, #F2F4F7)" }} />
          <div className="col-span-8 h-64 rounded-sm" style={{ background: "var(--surface-3, #F2F4F7)" }} />
        </div>
      </div>
    </PageFrame>
  );
}

function uniqueShiftCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const code = item.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function isLegacyShiftType(shiftCode: string): boolean {
  return shiftCode === "Day" || shiftCode === "Evening" || shiftCode === "Night";
}

export default function CockpitPage() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { date, shiftCode, line, setDate, setShiftCode, setLine } = useCockpitFilters();
  const { hasSession } = useSessionHealth();
  const sessionOk = hasSession === true;
  const [isDemo, setIsDemo] = useState(false);
  const [jumpingLatest, setJumpingLatest] = useState(false);
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

  const [legitimacyDrilldown, setLegitimacyDrilldown] = useState<ShiftLegitimacyDrilldown | null>(null);
  const [legitimacyDrilldownLoading, setLegitimacyDrilldownLoading] = useState(false);
  const hasShiftCode = shiftCode.trim().length > 0;

  // Only query params: date, shift_code, optional line, optional show_resolved=1. Default show_resolved OFF.
  const summaryParams = (() => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (shiftCode) p.set("shift_code", shiftCode);
    if (line && line !== "all") p.set("line", line);
    if (showResolved) p.set("show_resolved", "1");
    return p;
  })();
  const issuesParams = (() => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (shiftCode) p.set("shift_code", shiftCode);
    if (line && line !== "all") p.set("line", line);
    if (showResolved) p.set("show_resolved", "1");
    return p;
  })();
  const summaryUrl = `/api/cockpit/summary?${summaryParams.toString()}`;
  const issuesUrl = `/api/cockpit/issues?${issuesParams.toString()}`;

  // URL sync: read date, shift_code, line from URL on mount
  useEffect(() => {
    if (urlSyncedRef.current) return;
    const rawDate = searchParams.get("date")?.trim();
    const urlDate = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null;
    const initialDate = urlDate ?? getInitialDateFromUrlOrToday(searchParams);
    const qShift = (searchParams.get("shift_code") ?? searchParams.get("shift"))?.trim();
    const qLine = searchParams.get("line")?.trim();

    if (date !== initialDate) setDate(initialDate);
    if (qShift) setShiftCode(qShift);
    if (qLine != null) setLine(qLine === "" || qLine === "all" ? "all" : qLine);

    if (!urlDate) {
      const p = new URLSearchParams(searchParams.toString());
      p.set("date", initialDate);
      router.replace(`/app/cockpit?${p.toString()}`, { scroll: false });
    }
    urlSyncedRef.current = true;
  }, [searchParams, setDate, setShiftCode, setLine, router, date]);

  // Data-driven shift selector: fetch shift codes for selected date, then validate/fallback shift_code.
  useEffect(() => {
    if (isDemoMode() || !sessionOk) return;
    let cancelled = false;
    const p = new URLSearchParams({ date });
    fetchJson<{ ok: boolean; shift_codes?: string[] }>(`/api/cockpit/shift-codes?${p.toString()}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.error || "Failed to load shift codes");
        }
        const codes = uniqueShiftCodes(res.data.shift_codes);
        if (cancelled) return;
        setAvailableShiftCodes(codes);
        if (codes.length === 0) {
          if (shiftCode !== "") setShiftCode("");
          return;
        }
        const fromUrlRaw = (searchParams.get("shift_code") ?? searchParams.get("shift") ?? "").trim().toLowerCase();
        const fromUrl = fromUrlRaw
          ? codes.find((code) => code.toLowerCase() === fromUrlRaw) ?? null
          : null;
        const currentRaw = shiftCode.trim().toLowerCase();
        const current = currentRaw
          ? codes.find((code) => code.toLowerCase() === currentRaw) ?? null
          : null;
        const nextShiftCode = current ?? fromUrl ?? codes[0];
        if (nextShiftCode !== shiftCode) setShiftCode(nextShiftCode);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[cockpit] shift codes", err);
        setAvailableShiftCodes([]);
      });
    return () => { cancelled = true; };
  }, [date, sessionOk, searchParams, setShiftCode, shiftCode]);

  // URL sync: push date, shift_code, line to URL when they change
  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", date);
    if (shiftCode) p.set("shift_code", shiftCode);
    else p.delete("shift_code");
    p.delete("shift");
    p.set("line", line);
    const next = p.toString();
    const current = searchParams.toString();
    if (next !== current) router.replace(`/app/cockpit?${next}`, { scroll: false });
  }, [date, shiftCode, line, router, searchParams]);

  // Dev-only safety: warn if URL/date ever diverge after sync
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!urlSyncedRef.current) return;
    const urlDate = searchParams.get("date")?.trim();
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate) && urlDate !== date) {
      console.warn("[cockpit] Date diverged from URL", { stateDate: date, urlDate });
    }
  }, [date, searchParams]);

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

  // Load cockpit summary (date, shift_code, optional line). Skip when session invalid to avoid 401 spam.
  useEffect(() => {
    if (!sessionOk || !hasShiftCode) {
      setSummary(null);
      setSummaryLoading(false);
      return;
    }
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
  }, [sessionOk, hasShiftCode, summaryUrl, toast]);

  const handleJumpLatest = async () => {
    if (jumpingLatest || isDemoMode() || !hasShiftCode) return;
    setJumpingLatest(true);
    try {
      const searchBack = async (fromDate: string, daysLeft: number): Promise<string | null> => {
        for (let i = 1; i <= daysLeft; i++) {
          const d = dateDaysAgo(fromDate, i);
          const res = await fetchJson<CockpitSummaryResponse>(
            `/api/cockpit/summary?${cockpitSummaryParams({
              date: d,
              shift_code: shiftCode,
              line: line === "all" ? undefined : line,
              show_resolved: showResolved,
            }).toString()}`
          );
          if (res.ok && res.data && res.data.active_total > 0) return d;
        }
        return null;
      };
      const found = await searchBack(date, 14);
      if (found != null) setDate(found);
    } catch (err) {
      console.error("[cockpit] Jump to latest failed", err);
    } finally {
      setJumpingLatest(false);
    }
  };

  // Load Tomorrow's Gaps (top risks) for same date/shift — same engine as Tomorrow's Gaps page
  useEffect(() => {
    if (isDemoMode() || !sessionOk || !hasShiftCode) return;
    if (!isLegacyShiftType(shiftCode)) {
      setGapsLines([]);
      setGapsLoading(false);
      return;
    }
    let cancelled = false;
    setGapsLoading(true);
    const params = new URLSearchParams({ date, shift_code: shiftCode });
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
  }, [date, shiftCode, sessionOk, hasShiftCode, toast]);

  // Load Issue Inbox (date, shift_code, optional line)
  useEffect(() => {
    if (isDemoMode() || !sessionOk || !hasShiftCode) return;
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
  }, [issuesUrl, sessionOk, hasShiftCode, toast, issuesRefreshKey]);

  // Fetch shift legitimacy drilldown when status is ILLEGAL or WARNING (for blocking/at-risk lists)
  useEffect(() => {
    if (isDemoMode() || !sessionOk || !summary || !hasShiftCode) return;
    const status = summary.shift_legitimacy_status;
    if (status !== "ILLEGAL" && status !== "WARNING") {
      setLegitimacyDrilldown(null);
      return;
    }
    let cancelled = false;
    setLegitimacyDrilldownLoading(true);
    const params = new URLSearchParams({ date, shift_code: shiftCode, line });
    fetchJson<{
      ok?: boolean;
      shift_ids?: Array<{ shift_id: string; shift_code: string; line: string | null; shift_date: string }>;
    }>(`/api/cockpit/shift-ids?${params.toString()}`)
      .then((res) => {
        if (!res.ok || !res.data?.shift_ids?.length) return null;
        return res.data.shift_ids[0]?.shift_id ?? null;
      })
      .then((shiftId) => {
        if (cancelled || !shiftId) {
          if (!cancelled) setLegitimacyDrilldown(null);
          return;
        }
        const drillParams = new URLSearchParams({ date });
        return fetchJson<ShiftLegitimacyDrilldown>(
          `/api/cockpit/shift-legitimacy/${shiftId}?${drillParams.toString()}`
        ).then((r) => (r.ok ? r.data : null));
      })
      .then((data) => {
        if (!cancelled) {
          setLegitimacyDrilldown(data ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setLegitimacyDrilldownLoading(false);
      });
    return () => { cancelled = true; };
  }, [date, shiftCode, line, sessionOk, hasShiftCode, summary?.shift_legitimacy_status, summary != null]);

  const topRisks = gapsLines
    .filter((l) => l.competenceStatus === "NO-GO" || l.competenceStatus === "WARNING")
    .sort((a, b) => {
      if (a.competenceStatus !== b.competenceStatus) return a.competenceStatus === "NO-GO" ? -1 : 1;
      return b.gapHours - a.gapHours;
    })
    .slice(0, 5);

  // Load line options from v_cockpit_station_summary.area for selected date+shift (no legacy codes)
  useEffect(() => {
    if (isDemoMode() || !sessionOk || !hasShiftCode) return;
    const p = new URLSearchParams({ date, shift_code: shiftCode });
    const url = `/api/cockpit/lines?${p.toString()}`;
    fetchJson<{ lines?: string[] }>(url)
      .then((res) => {
        if (!res.ok) return;
        setAvailableLines(res.data.lines ?? []);
        if ("source" in res.data && res.data.source) console.debug("[cockpit lines] source:", res.data.source);
      })
      .catch((err) => console.error("[cockpit lines]", err));
  }, [date, shiftCode, sessionOk, hasShiftCode]);

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
    if (!sessionOk) return;
    if (process.env.NODE_ENV !== "production") {
      console.log("[ui] handleIssueRowClick", {
        stationId: row.station_id,
        shift_code: row.shift_code,
        date: row.date,
      });
    }
    setSelectedIssue(row);
    setIssueDrawerOpen(true);
  };

  const handleIssueDecision = async (action: "acknowledged" | "plan_training" | "swap" | "escalate") => {
    if (!sessionOk || !selectedIssue?.station_id) return;
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

  // Fragility Index 0–100 from severity (BLOCKING = 25 pts, WARNING = 8 pts). UI-only, no backend.
  const blockingCount = summary?.active_blocking ?? issues.filter((i) => !i.resolved && i.severity === "BLOCKING").length;
  const warningCount = summary?.active_nonblocking ?? issues.filter((i) => !i.resolved && i.severity === "WARNING").length;
  const fragilityBlockingPts = blockingCount * 25;
  const fragilityWarningPts = warningCount * 8;
  const fragilityIndex = Math.min(100, fragilityBlockingPts + fragilityWarningPts);

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
            className="h-8 px-2 rounded-sm border border-[var(--hairline)] bg-[var(--surface)] text-[var(--text)] cockpit-body"
            data-testid="input-date"
          />
          <Select value={shiftCode || undefined} onValueChange={setShiftCode} disabled={availableShiftCodes.length === 0}>
            <SelectTrigger className="h-8 w-[110px] px-2 text-[13px]" data-testid="select-shift">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              {availableShiftCodes.length > 0 ? (
                availableShiftCodes.map((code) => (
                  <SelectItem key={code} value={code}>{code}</SelectItem>
                ))
              ) : (
                <SelectItem value="__no_shift_codes" disabled>No shifts</SelectItem>
              )}
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
              className="rounded-sm border-[var(--hairline)]"
              data-testid="cockpit-show-resolved"
            />
            Show resolved
          </label>
        </div>
        {!summaryLoading && summary != null && (
          <span className="gov-kicker cockpit-num" data-testid="cockpit-active-count">
            Open decisions: {summary.active_total}
          </span>
        )}
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
      {summary && summary.active_total === 0 && !summaryLoading && (
        <div className="mb-6 gov-panel px-5 py-4 flex flex-wrap items-center justify-between gap-3" data-testid="cockpit-empty-state">
          <span className="cockpit-body" style={{ color: "var(--text-2)" }}>No decisions</span>
          <div className="flex flex-wrap items-center gap-2">
            {availableShiftCodes.map((code) => (
              <Button key={code} variant="outline" size="sm" className="h-7 text-[13px]" onClick={() => setShiftCode(code)} data-testid={`empty-shift-${code}`}>
                {code}
              </Button>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-[13px]"
              onClick={handleJumpLatest}
              disabled={jumpingLatest || !hasShiftCode}
              data-testid="empty-jump-latest"
            >
              Jump to latest
            </Button>
          </div>
        </div>
      )}

      {lastResolvedIssue != null && undoUntil > 0 && (
        <div className="mb-6 gov-panel flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-l-[3px] border-l-[hsl(var(--ds-status-ok-text))]" data-testid="cockpit-resolve-undo-bar">
          <div className="flex flex-wrap items-center gap-3 cockpit-body">
            <span className="cockpit-status-ok font-medium">Decision recorded.</span>
            <span className="cockpit-num" style={{ color: "var(--text-2)" }}>Undo ({undoSecondsLeft}s)</span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-[13px]" onClick={handleResolveUndo} data-testid="cockpit-resolve-undo-btn">
            Undo
          </Button>
        </div>
      )}

      {/* Hero: shift legitimacy status */}
      {!summaryLoading && summary != null && (
        <section
          className="gov-panel gov-panel--elevated py-16 md:py-20 text-center animate-in fade-in duration-300"
          data-testid="cockpit-hero"
        >
          <div className="space-y-4 px-6">
            <p className="gov-kicker">Execution Legitimacy</p>
            <h1
              className={[
                "text-4xl font-extrabold tracking-tight md:text-5xl leading-none",
                summary.shift_legitimacy_status === "GO" && "cockpit-status-ok",
                summary.shift_legitimacy_status === "WARNING" && "cockpit-status-at-risk",
                summary.shift_legitimacy_status === "ILLEGAL" && "cockpit-status-blocking",
              ].filter(Boolean).join(" ")}
            >
              {summary.shift_legitimacy_status === "GO" && "SHIFT READY"}
              {summary.shift_legitimacy_status === "WARNING" && "SHIFT AT RISK"}
              {summary.shift_legitimacy_status === "ILLEGAL" && "SHIFT NOT LEGALLY READY"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-2)" }}>
              {summary.illegal_count} blockers · {summary.warning_count} expiring soon
            </p>
          </div>
        </section>
      )}

      {/* Conditional detail: blocking / at-risk operators */}
      {!summaryLoading && summary != null && (summary.shift_legitimacy_status === "ILLEGAL" || summary.shift_legitimacy_status === "WARNING") && (
        <section className="mt-8 max-w-2xl mx-auto gov-panel p-6" data-testid="cockpit-detail">
          {summary.shift_legitimacy_status === "ILLEGAL" && (
            <>
              <h2 className="gov-kicker mb-3">
                Blocking operators
              </h2>
              {legitimacyDrilldownLoading ? (
                <p className="text-sm py-2" style={{ color: "var(--text-2)" }}>Loading…</p>
              ) : legitimacyDrilldown && legitimacyDrilldown.blocking_employees.length > 0 ? (
                <ul>
                  {legitimacyDrilldown.blocking_employees.map((emp) => (
                    <li key={emp.id} className="flex items-center justify-between gap-4 py-3 border-t first:border-t-0" style={{ borderColor: "var(--hairline-soft)" }}>
                      <span className="font-medium" style={{ color: "var(--text)" }}>{emp.name || "—"}</span>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {emp.reasons.map((r) => (
                          <span key={r} className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm py-2" style={{ color: "var(--text-2)" }}>No blocking operators listed.</p>
              )}
            </>
          )}
          {summary.shift_legitimacy_status === "WARNING" && (
            <>
              <h2 className="gov-kicker mb-3">
                At risk
              </h2>
              {legitimacyDrilldownLoading ? (
                <p className="text-sm py-2" style={{ color: "var(--text-2)" }}>Loading…</p>
              ) : legitimacyDrilldown && legitimacyDrilldown.warning_employees.length > 0 ? (
                <ul>
                  {legitimacyDrilldown.warning_employees.map((emp) => (
                    <li key={emp.id} className="flex items-center justify-between gap-4 py-3 border-t first:border-t-0" style={{ borderColor: "var(--hairline-soft)" }}>
                      <span className="font-medium" style={{ color: "var(--text)" }}>{emp.name || "—"}</span>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {emp.reasons.map((r) => (
                          <span key={r} className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ color: "var(--text-2)", background: "var(--surface-2)" }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm py-2" style={{ color: "var(--text-2)" }}>No at-risk operators listed.</p>
              )}
            </>
          )}
        </section>
      )}

      {/* Supporting metrics: compact row */}
      {!summaryLoading && summary != null && (
        <div className="mt-10 gov-panel p-6" data-testid="cockpit-metrics">
          <div className="flex flex-wrap items-baseline gap-10">
            <div>
              <p className="gov-kicker">Open decisions</p>
              <p className="text-lg font-semibold tabular-nums mt-1" style={{ color: "var(--text)" }}>{summary.active_total}</p>
            </div>
            <div>
              <p className="gov-kicker">Blockers</p>
              <p className="text-lg font-semibold tabular-nums mt-1 cockpit-status-blocking">{summary.illegal_count}</p>
            </div>
            <div>
              <p className="gov-kicker">Restricted</p>
              <p className="text-lg font-semibold tabular-nums mt-1" style={{ color: "var(--text)" }}>{summary.restricted_count ?? 0}</p>
            </div>
            <div>
              <p className="gov-kicker">Expiring soon</p>
              <p className="text-lg font-semibold tabular-nums mt-1 cockpit-status-at-risk">{summary.warning_count}</p>
            </div>
            {!isDemoMode() && (
              <div title={`Blocking: ${blockingCount} × 25 · Warnings: ${warningCount} × 8`}>
                <p className="gov-kicker">Readiness</p>
                <p className="text-lg font-semibold tabular-nums mt-1" style={{ color: "var(--text)" }}>{fragilityIndex}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {!isDemoMode() && (
        <div className="mt-10">
          <InterventionQueue
            issues={issues}
            markedPlannedIds={markedPlannedIds}
            currentFragility={fragilityIndex}
            sessionOk={sessionOk}
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
          <h2 className="gov-kicker mb-3 mt-6">Decision queue</h2>
          <IssueTable
            issues={issues}
            loading={issuesLoading}
            error={issuesError}
            onRowClick={handleIssueRowClick}
            sessionOk={sessionOk}
          />
        </div>
      )}

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
        shift={shiftCode}
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
        sessionOk={sessionOk}
      />
    </PageFrame>
  );
}
