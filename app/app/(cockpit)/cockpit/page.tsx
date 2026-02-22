"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { getInitialDateFromUrlOrToday, useCockpitFilters } from "@/lib/CockpitFilterContext";
import { useSessionHealth } from "@/lib/SessionHealthContext";
import { ActionDrawer } from "@/components/cockpit/ActionDrawer";
import { StaffingSuggestModal } from "@/components/cockpit/StaffingSuggestModal";
import { LineRootCauseDrawer } from "@/components/line-overview/LineRootCauseDrawer";
import { IssueTable } from "@/components/cockpit/IssueTable";
import { IssueDrawer } from "@/components/cockpit/IssueDrawer";
import { DecisionQueueInlinePanel } from "@/components/cockpit/DecisionQueue";
import { ExecutiveHeader } from "@/components/cockpit/ExecutiveHeader";
import { InlinePanelShell } from "@/components/cockpit/InlinePanelShell";
import { KpiTile } from "@/components/cockpit/KpiTile";
import { ExpiringSoonPanel, type ExpiringRow } from "@/components/cockpit/panels/ExpiringSoonPanel";
import {
  ReadinessPanel,
  type ReadinessCounts,
  type ReadinessStatus,
  type ReadinessTopStationRow,
} from "@/components/cockpit/panels/ReadinessPanel";
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
  const [shiftCodesError, setShiftCodesError] = useState<string | null>(null);
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
  const [decisionQueueMode, setDecisionQueueMode] = useState<"GLOBAL" | "SHIFT">("GLOBAL");
  const [activePanel, setActivePanel] = useState<
    "none" | "decisions" | "blockers" | "readiness" | "restricted" | "expiring" | "interventions"
  >("none");
  const [userName, setUserName] = useState<string | null>(null);
  const [complianceExpiring, setComplianceExpiring] = useState<{
    expiredCount: number;
    expiringCount: number;
    top10: ExpiringRow[];
  } | null>(null);
  const [complianceExpiringLoading, setComplianceExpiringLoading] = useState(false);

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
    if (isDemoMode()) return;
    let cancelled = false;
    const p = new URLSearchParams({ date });
    fetchJson<{ ok: boolean; shift_codes?: string[] }>(`/api/cockpit/shift-codes?${p.toString()}`)
      .then((res) => {
        if (!res.ok) {
          if (cancelled) return;
          const message = res.status === 401 ? "Invalid or expired session" : (res.error || "Failed to load shift codes");
          setShiftCodesError(message);
          setAvailableShiftCodes([]);
          return;
        }
        const codes = uniqueShiftCodes(res.data.shift_codes);
        if (cancelled) return;
        setShiftCodesError(null);
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
        setShiftCodesError("Failed to load shift codes");
        setAvailableShiftCodes([]);
      });
    return () => { cancelled = true; };
  }, [date, sessionOk]);

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
  }, [date, shiftCode, line, router]);

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

  // Compliance overview for Expiring soon tile + panel (single shared fetch)
  useEffect(() => {
    if (isDemoMode() || !sessionOk) return;
    let cancelled = false;
    setComplianceExpiringLoading(true);
    fetchJson<{
      ok?: boolean;
      kpis?: Record<string, { valid: number; expiring: number; expired: number; missing: number; waived: number }>;
      rows?: Array<{
        employee_id: string;
        employee_name: string;
        compliance_name: string;
        status: string;
        valid_to: string | null;
        line: string | null;
      }>;
    }>("/api/compliance/overview")
      .then((res) => {
        if (!res.ok || !res.data?.ok || cancelled) return;
        const kpis = res.data.kpis ?? {};
        const expiredCount = Object.values(kpis).reduce((s, k) => s + (k.expired ?? 0), 0);
        const expiringCount = Object.values(kpis).reduce((s, k) => s + (k.expiring ?? 0), 0);
        let rows = (res.data.rows ?? []).filter(
          (r) => r.status === "expired" || r.status === "expiring"
        ) as Array<{ employee_id: string; employee_name: string; compliance_name: string; status: string; valid_to: string | null; line: string | null }>;
        if (line && line !== "all") {
          rows = rows.filter((r) => (r.line ?? "").trim() === line.trim());
        }
        rows.sort((a, b) => {
          const aExpired = a.status === "expired" ? 0 : 1;
          const bExpired = b.status === "expired" ? 0 : 1;
          if (aExpired !== bExpired) return aExpired - bExpired;
          const va = a.valid_to ?? "";
          const vb = b.valid_to ?? "";
          return va.localeCompare(vb);
        });
        const top10: ExpiringRow[] = rows.slice(0, 10).map((r) => ({
          employee_id: r.employee_id,
          employee_name: r.employee_name,
          compliance_name: r.compliance_name,
          valid_to: r.valid_to,
          status: r.status === "expired" ? "expired" : "expiring",
        }));
        if (!cancelled) {
          setComplianceExpiring({ expiredCount, expiringCount, top10 });
        }
      })
      .catch(() => {
        if (!cancelled) setComplianceExpiring(null);
      })
      .finally(() => {
        if (!cancelled) setComplianceExpiringLoading(false);
      });
    return () => { cancelled = true; };
  }, [sessionOk, line]);

  // Optional: user display name from whoami (existing endpoint)
  useEffect(() => {
    if (isDemoMode()) return;
    fetchJson<{ user?: { email?: string | null }; email?: string | null }>("/api/auth/whoami")
      .then((res) => {
        if (!res.ok) return;
        const email = res.data?.user?.email ?? res.data?.email;
        if (typeof email === "string" && email.includes("@")) {
          const part = email.split("@")[0];
          if (part) setUserName(part.replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()));
        }
      })
      .catch(() => {});
  }, []);

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

  /** Plan action/training: client-only planned state; do not close drawer or remove issue. */
  const handlePlanAction = () => {
    if (selectedIssue) {
      setMarkedPlannedIds((prev) => new Set(prev).add(selectedIssue.issue_id));
      toast({ title: "Planned" });
    }
  };

  const handlePlanTraining = () => {
    if (selectedIssue) {
      setMarkedPlannedIds((prev) => new Set(prev).add(selectedIssue.issue_id));
      toast({ title: "Planned" });
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
  const _blockingForFragility = issues.filter((i) => i.severity === "BLOCKING").length;
  const _warningForFragility = issues.filter((i) => i.severity === "WARNING").length;
  const fragilityBlockingPts = _blockingForFragility * 25;
  const fragilityWarningPts = _warningForFragility * 8;
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

  const handleTileClick = (id: typeof activePanel) => {
    setActivePanel((current) => (current === id ? "none" : id));
  };

  function getRootCausePrimary(issue: CockpitIssueRow): string {
    const rc = issue.root_cause as Record<string, unknown> | null | undefined;
    const primary = rc?.primary;
    return typeof primary === "string" ? primary : "—";
  }

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

  // Deterministic readiness from issues[] (no backend change)
  const totalActive = issues.length;
  const blockingCount = issues.filter((i) => i.severity === "BLOCKING").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const illegalCount = issues.filter((i) => (i.issue_type ?? (i as { type?: string }).type) === "ILLEGAL").length;
  const unstaffedCount = issues.filter((i) => (i.issue_type ?? (i as { type?: string }).type) === "UNSTAFFED").length;
  const blockingIssues = issues.filter((i) => i.severity === "BLOCKING");
  const warningIssues = issues.filter((i) => i.severity === "WARNING");
  const uniqueStationsBlocking = new Set(blockingIssues.map((i) => i.station_id ?? i.station_name ?? "")).size;
  const uniqueStationsWarning = new Set(warningIssues.map((i) => i.station_id ?? i.station_name ?? "")).size;
  const readinessStatus: ReadinessStatus =
    illegalCount > 0 ? "NO-GO" : blockingCount > 0 ? "NO-GO" : warningCount > 0 ? "WARNING" : "GO";
  const readinessSubtitle =
    readinessStatus === "NO-GO"
      ? `${blockingCount} blocking issue(s) across ${uniqueStationsBlocking} station(s)`
      : readinessStatus === "WARNING"
        ? `${warningCount} warning(s) across ${uniqueStationsWarning} station(s)`
        : "No active issues";
  const issueTypeOrder = (t: string) => (t === "ILLEGAL" ? 0 : t === "UNSTAFFED" ? 1 : t === "NO_GO" ? 2 : 3);
  const topStations: ReadinessTopStationRow[] = [...issues]
    .sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === "BLOCKING" ? -1 : 1;
      return issueTypeOrder((a.issue_type ?? (a as { type?: string }).type) ?? "") - issueTypeOrder((b.issue_type ?? (b as { type?: string }).type) ?? "");
    })
    .slice(0, 8)
    .map((issue) => ({
      station_name: issue.station_name ?? issue.station_code ?? "",
      station_id: issue.station_id ?? "",
      issue_type: (issue.issue_type ?? (issue as { type?: string }).type) ?? "",
      root_cause_primary: getRootCausePrimary(issue),
      shift_code: issue.shift_code ?? "",
      date: issue.date ?? "",
      issue,
    }));
  const readinessCounts: ReadinessCounts = {
    totalActive,
    blockingCount,
    warningCount,
    illegalCount,
    unstaffedCount,
  };
  const blockersCount = blockingCount;

  const emptyStatePanel = (
    <div className="py-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-2)" }}>
        Not configured yet for this pilot dataset.
      </p>
      <Button disabled className="mt-3" size="sm" variant="outline">
        Configure
      </Button>
    </div>
  );

  return (
    <PageFrame debugPanel={debugPanel}>
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

      {/* Executive Overview */}
      {!isDemoMode() && (
        <>
          <ExecutiveHeader
            userName={userName}
            date={date}
            onDateChange={setDate}
            shiftCode={shiftCode}
            onShiftCodeChange={setShiftCode}
            availableShiftCodes={availableShiftCodes}
            shiftCodesError={shiftCodesError}
            line={line}
            onLineChange={setLine}
            lineOptions={lineOptions}
            showResolved={showResolved}
            onShowResolvedChange={setShowResolved}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="kpi-tile-grid">
            <KpiTile
              tileId="kpi-readiness"
              title="Readiness"
              primaryValue={readinessStatus}
              secondaryLabel={readinessStatus === "NO-GO" ? "Blocking" : readinessStatus === "WARNING" ? "Warnings" : "Active"}
              secondaryValue={readinessStatus === "NO-GO" ? blockingCount : readinessStatus === "WARNING" ? warningCount : 0}
              statusChip={readinessStatus === "NO-GO" ? "NO-GO" : readinessStatus === "WARNING" ? "AT RISK" : "GO"}
              statusChipVariant={
                readinessStatus === "NO-GO" ? "blocking" : readinessStatus === "WARNING" ? "warning" : "ok"
              }
              onClick={() => handleTileClick("readiness")}
            />
            <KpiTile
              tileId="kpi-blockers"
              title="Blockers"
              primaryValue={blockersCount}
              onClick={() => handleTileClick("blockers")}
            />
            <KpiTile
              tileId="kpi-restricted"
              title="Restricted"
              primaryValue="—"
              onClick={() => handleTileClick("restricted")}
            />
            <KpiTile
              tileId="kpi-expiring"
              title="Expiring soon"
              primaryValue={complianceExpiring?.expiringCount ?? "—"}
              secondaryLabel="Expired"
              secondaryValue={complianceExpiring?.expiredCount}
              statusChip={
                (complianceExpiring?.expiredCount ?? 0) > 0
                  ? "EXPIRED"
                  : (complianceExpiring?.expiringCount ?? 0) > 0
                    ? "EXPIRING"
                    : "OK"
              }
              statusChipVariant={
                (complianceExpiring?.expiredCount ?? 0) > 0
                  ? "blocking"
                  : (complianceExpiring?.expiringCount ?? 0) > 0
                    ? "warning"
                    : "ok"
              }
              onClick={() => handleTileClick("expiring")}
            />
            <KpiTile
              tileId="kpi-decisions"
              title="Open Decisions"
              primaryValue={issues.length}
              onClick={() => handleTileClick("decisions")}
            />
            <KpiTile
              tileId="kpi-interventions"
              title="Intervention Queue"
              primaryValue={issues.length}
              onClick={() => handleTileClick("interventions")}
            />
          </div>

          <DecisionQueueInlinePanel
            open={activePanel === "decisions"}
            issues={issues}
            markedPlannedIds={markedPlannedIds}
            mode={decisionQueueMode}
            onModeChange={setDecisionQueueMode}
            shiftCode={shiftCode}
            availableShiftCodes={availableShiftCodes}
            onShiftCodeChange={setShiftCode}
            onRowClick={handleIssueRowClick}
            onClose={() => setActivePanel("none")}
            sessionOk={sessionOk}
          />

          <InlinePanelShell
            open={activePanel === "blockers"}
            title="Blockers"
            subtitle="Blocking issues requiring review."
            onClose={() => setActivePanel("none")}
            dataTestId="blockers-panel"
          >
            {(() => {
              const blockingList = issues.filter((i) => !i.resolved && i.severity === "BLOCKING");
              if (blockingList.length === 0) {
                return <p className="text-sm py-4" style={{ color: "var(--text-2)" }}>No blocking issues.</p>;
              }
              return (
                <ul className="space-y-0">
                  {blockingList.map((issue) => (
                    <li key={issue.issue_id}>
                      <button
                        type="button"
                        onClick={() => sessionOk && handleIssueRowClick(issue)}
                        disabled={!sessionOk}
                        className="w-full flex items-center gap-4 py-3 px-0 text-left rounded-md transition-colors border-b border-[var(--hairline-soft)] last:border-b-0 hover:bg-[var(--surface-2)] cursor-pointer"
                        data-testid={`blockers-row-${issue.issue_id}`}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium" style={{ color: "var(--text)" }}>
                          {issue.station_name ?? issue.station_code ?? issue.station_id ?? "—"}
                        </span>
                        <span className="min-w-0 max-w-[50%] truncate text-sm" style={{ color: "var(--text-2)" }}>
                          {getRootCausePrimary(issue)}
                        </span>
                        <span className="text-xs cockpit-status-blocking font-medium shrink-0">Review</span>
                      </button>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </InlinePanelShell>

          <ReadinessPanel
            open={activePanel === "readiness"}
            title="Readiness"
            onClose={() => setActivePanel("none")}
            status={readinessStatus}
            subtitle={readinessSubtitle}
            counts={readinessCounts}
            topStations={topStations}
            onRowClick={handleIssueRowClick}
            sessionOk={sessionOk}
          />
          <InlinePanelShell
            open={activePanel === "restricted"}
            title="Restricted"
            subtitle="Restricted coverage."
            onClose={() => setActivePanel("none")}
            dataTestId="restricted-panel"
          >
            {emptyStatePanel}
          </InlinePanelShell>
          <ExpiringSoonPanel
            open={activePanel === "expiring"}
            title="Expiring soon"
            onClose={() => setActivePanel("none")}
            expiredCount={complianceExpiring?.expiredCount ?? 0}
            expiringCount={complianceExpiring?.expiringCount ?? 0}
            top10={complianceExpiring?.top10 ?? []}
            sessionOk={sessionOk}
            loading={complianceExpiringLoading}
          />
          <InlinePanelShell
            open={activePanel === "interventions"}
            title="Intervention Queue"
            subtitle="Actions that require follow-up."
            onClose={() => setActivePanel("none")}
            dataTestId="interventions-panel"
          >
            {emptyStatePanel}
          </InlinePanelShell>
        </>
      )}

      {!isDemoMode() && (
        <div className="mt-10" data-testid="cockpit-issues-section">
          <IssueTable
            issues={issues}
            loading={issuesLoading}
            error={issuesError}
            onRowClick={handleIssueRowClick}
            markedPlannedIds={markedPlannedIds}
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
        onPlanAction={handlePlanAction}
        onPlanTraining={handlePlanTraining}
        onSwap={() => handleIssueDecision("swap")}
        onEscalate={() => handleIssueDecision("escalate")}
        onResolve={() => handleIssueDecision("acknowledged")}
        isAcknowledged={selectedIssue?.resolved ?? false}
        planned={selectedIssue ? markedPlannedIds.has(selectedIssue.issue_id) : false}
        sessionOk={sessionOk}
      />
    </PageFrame>
  );
}
