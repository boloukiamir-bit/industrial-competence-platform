"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageFrame } from "@/components/layout/PageFrame";
import { COST_ENGINE, formatSekRange, formatHoursRange, FRAGILITY_PTS } from "@/lib/cockpitCostEngine";
import { Lightbulb, Loader2, Save, Link2, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";

const DRAFT_STORAGE_KEY = "scenario-builder-drafts";
const MAX_DRAFTS = 10;

const SCENARIO_TYPES = [
  { id: "add_station", label: "Add station / machine", short: "A" },
  { id: "increase_demand", label: "Increase demand hours", short: "B" },
  { id: "remove_capacity", label: "Remove capacity", short: "C" },
] as const;

type ScenarioTypeId = (typeof SCENARIO_TYPES)[number]["id"];

type ScenarioState = {
  scenarioType: ScenarioTypeId;
  selectedStationId: string;
  selectedSkillId: string;
  selectedLine: string;
  deltaHours: string;
  peopleRemoved: string;
  targetShift: string;
};

type SavedDraft = ScenarioState & { timestamp: number; title: string };

type PlanOwner = "Ops" | "Supervisor" | "HR";

type PlanItem = {
  title: string;
  owner: PlanOwner;
  etaWeeks: number;
  outcome: string;
};

type ReadinessStatus = "Ready" | "Partially ready" | "Blocked";

type ReadinessState = {
  status: ReadinessStatus;
  bullets: string[];
};

const SHIFT_OPTIONS = ["Day", "Evening", "Night"] as const;

type StationOption = { id: string; station_name: string; station_code: string; line: string };
type SkillOption = { id: string; code: string; name: string; category?: string };
type RequirementsByLine = {
  line: string;
  stations: { id: string; name: string }[];
  skills: { id: string; code: string | null; name: string | null }[];
  requirements: { station_id: string; skill_id: string }[];
};

function loadDraftsFromStorage(): SavedDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_DRAFTS) : [];
  } catch {
    return [];
  }
}

function saveDraftsToStorage(drafts: SavedDraft[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
  } catch {
    // ignore
  }
}

function scenarioStateToParams(state: ScenarioState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("t", state.scenarioType);
  if (state.selectedStationId) p.set("s", state.selectedStationId);
  if (state.selectedSkillId) p.set("sk", state.selectedSkillId);
  if (state.selectedLine) p.set("l", state.selectedLine);
  if (state.deltaHours) p.set("dh", state.deltaHours);
  if (state.peopleRemoved) p.set("pr", state.peopleRemoved);
  if (state.targetShift) p.set("sh", state.targetShift);
  return p;
}

function paramsToScenarioState(params: URLSearchParams): Partial<ScenarioState> | null {
  const t = params.get("t");
  if (!t || !["add_station", "increase_demand", "remove_capacity"].includes(t)) return null;
  return {
    scenarioType: t as ScenarioTypeId,
    selectedStationId: params.get("s") ?? "",
    selectedSkillId: params.get("sk") ?? "",
    selectedLine: params.get("l") ?? "",
    deltaHours: params.get("dh") ?? "10",
    peopleRemoved: params.get("pr") ?? "2",
    targetShift: params.get("sh") ?? SHIFT_OPTIONS[0],
  };
}

export default function ScenarioBuilderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stations, setStations] = useState<StationOption[]>([]);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [requirementsByLine, setRequirementsByLine] = useState<RequirementsByLine | null>(null);
  const [loadingStations, setLoadingStations] = useState(true);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingLines, setLoadingLines] = useState(true);
  const [loadingRequirements, setLoadingRequirements] = useState(false);

  const [scenarioType, setScenarioType] = useState<ScenarioTypeId>("add_station");
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [selectedSkillId, setSelectedSkillId] = useState<string>("");
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [deltaHours, setDeltaHours] = useState<string>("10");
  const [peopleRemoved, setPeopleRemoved] = useState<string>("2");
  const [targetShift, setTargetShift] = useState<string>(SHIFT_OPTIONS[0]);

  const [drafts, setDrafts] = useState<SavedDraft[]>([]);

  useEffect(() => {
    setDrafts(loadDraftsFromStorage());
  }, []);

  const urlAppliedRef = useRef(false);
  useEffect(() => {
    if (urlAppliedRef.current) return;
    const state = paramsToScenarioState(searchParams);
    if (!state) return;
    urlAppliedRef.current = true;
    if (state.scenarioType != null) setScenarioType(state.scenarioType);
    if (state.selectedStationId != null) setSelectedStationId(state.selectedStationId);
    if (state.selectedSkillId != null) setSelectedSkillId(state.selectedSkillId);
    if (state.selectedLine != null) setSelectedLine(state.selectedLine);
    if (state.deltaHours != null) setDeltaHours(state.deltaHours);
    if (state.peopleRemoved != null) setPeopleRemoved(state.peopleRemoved);
    if (state.targetShift != null) setTargetShift(state.targetShift);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoadingStations(true);
    fetchJson<{ stations?: StationOption[]; error?: string }>("/api/line-overview/stations")
      .then((res) => (res.ok ? res.data : null))
      .then((data) => {
        if (!cancelled && data?.stations) setStations(data.stations);
      })
      .finally(() => { if (!cancelled) setLoadingStations(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingSkills(true);
    fetchJson<{ skills?: SkillOption[]; error?: string }>("/api/skills")
      .then((res) => (res.ok ? res.data : null))
      .then((data) => {
        if (!cancelled && data?.skills) setSkills(data.skills);
      })
      .finally(() => { if (!cancelled) setLoadingSkills(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingLines(true);
    fetchJson<{ lines?: string[]; error?: string }>("/api/lines")
      .then((res) => (res.ok ? res.data : null))
      .then((data) => {
        if (!cancelled && data?.lines?.length) {
          setLines(data.lines);
          if (!selectedLine && data.lines[0]) setSelectedLine(data.lines[0]);
        }
      })
      .finally(() => { if (!cancelled) setLoadingLines(false); });
    return () => { cancelled = true; };
  }, []);

  const selectedStation = useMemo(
    () => stations.find((s) => s.id === selectedStationId) ?? null,
    [stations, selectedStationId]
  );

  const fetchRequirementsForLine = useCallback((line: string) => {
    if (!line) {
      setRequirementsByLine(null);
      return;
    }
    setLoadingRequirements(true);
    setRequirementsByLine(null);
    fetchJson<RequirementsByLine & { error?: string }>(`/api/requirements/by-line?line=${encodeURIComponent(line)}`)
      .then((res) => (res.ok ? res.data : null))
      .then((data) => {
        if (data && !("error" in data)) setRequirementsByLine(data as RequirementsByLine);
      })
      .finally(() => setLoadingRequirements(false));
  }, []);

  useEffect(() => {
    if (selectedStation?.line) fetchRequirementsForLine(selectedStation.line);
    else if (selectedLine && (scenarioType === "increase_demand" || scenarioType === "remove_capacity"))
      fetchRequirementsForLine(selectedLine);
    else setRequirementsByLine(null);
  }, [selectedStation?.id, selectedStation?.line, selectedLine, scenarioType, fetchRequirementsForLine]);

  const deltaHoursNum = Math.max(0, parseFloat(deltaHours) || 0);
  const peopleRemovedNum = Math.max(0, parseInt(peopleRemoved, 10) || 0);

  const topBlockersFromData = useMemo(() => {
    const reqs = requirementsByLine?.requirements ?? [];
    const skillsList = requirementsByLine?.skills ?? [];
    const stationsList = requirementsByLine?.stations ?? [];
    const skillMap = new Map(skillsList.map((s) => [s.id, s.code ?? s.name ?? s.id]));
    const stationMap = new Map(stationsList.map((s) => [s.id, s.name ?? s.id]));

    if (selectedStationId && selectedStation) {
      const forStation = reqs.filter((r) => r.station_id === selectedStationId);
      const labels = forStation
        .map((r) => {
          const code = skillMap.get(r.skill_id) ?? r.skill_id;
          return `${code} at ${selectedStation.station_name ?? selectedStation.station_code}`;
        })
        .slice(0, 5);
      return labels.length ? labels : null;
    }
    if (selectedLine && reqs.length > 0) {
      const seen = new Set<string>();
      const labels = reqs
        .map((r) => {
          const code = skillMap.get(r.skill_id) ?? r.skill_id;
          const stationName = stationMap.get(r.station_id) ?? r.station_id;
          return `${code} at ${stationName}`;
        })
        .filter((l) => {
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        })
        .slice(0, 5);
      return labels.length ? labels : null;
    }
    return null;
  }, [requirementsByLine, selectedStationId, selectedStation, selectedLine]);

  const outputs = useMemo(() => {
    const severity = scenarioType === "remove_capacity" && peopleRemovedNum >= 2 ? "BLOCKING" : "WARNING";
    const r = COST_ENGINE[severity];
    const fragilityDelta =
      scenarioType === "add_station"
        ? 8
        : scenarioType === "increase_demand"
          ? 25
          : Math.min(100, 25 * peopleRemovedNum);
    const timeToReadinessWeeks =
      scenarioType === "add_station"
        ? 2
        : scenarioType === "increase_demand"
          ? Math.min(8, 2 + Math.ceil(deltaHoursNum / 15))
          : 1;
    const trainingPeople = scenarioType === "add_station" ? 2 : scenarioType === "increase_demand" ? 3 : 0;
    const levelUpgrades = scenarioType === "add_station" ? 1 : scenarioType === "increase_demand" ? 2 : 0;
    const trainingLoad =
      trainingPeople > 0
        ? `${trainingPeople} people × ${levelUpgrades} level upgrade${levelUpgrades !== 1 ? "s" : ""}`
        : "—";
    const topBlockers: string[] =
      topBlockersFromData?.length
        ? topBlockersFromData
        : scenarioType === "add_station"
          ? ["Select a station to see required skills", "Certification may be required"]
          : scenarioType === "increase_demand"
            ? ["Select a line to see coverage blockers", "Capacity and shift overlap"]
            : ["Coverage gap on " + targetShift, "Backfill for removed capacity"];

    return {
      fragilityDelta,
      costMin: r.costMin,
      costMax: r.costMax,
      timeToReadinessWeeks,
      trainingLoad,
      topBlockers,
    };
  }, [
    scenarioType,
    peopleRemovedNum,
    deltaHoursNum,
    targetShift,
    topBlockersFromData,
  ]);

  const blockersCount = topBlockersFromData?.length ?? requirementsByLine?.requirements?.length ?? 0;

  const comparison = useMemo(() => {
    const W = COST_ENGINE.WARNING;
    const B = COST_ENGINE.BLOCKING;
    const currentFragility = Math.min(100, blockersCount * FRAGILITY_PTS.WARNING);
    const currentCostMin = blockersCount * W.costMin;
    const currentCostMax = blockersCount * W.costMax;
    const currentTimeMin = blockersCount * W.hoursMin;
    const currentTimeMax = blockersCount * W.hoursMax;
    const currentTimeToReadiness = blockersCount > 0 ? 1 : 0;
    const currentTrainingLoad = blockersCount > 0 ? "1+ people (existing gaps)" : "—";

    let deltaFragility: number;
    let deltaCostMin: number;
    let deltaCostMax: number;
    let deltaTimeMin: number;
    let deltaTimeMax: number;
    if (scenarioType === "add_station") {
      deltaFragility = -FRAGILITY_PTS.WARNING;
      deltaCostMin = -W.costMin;
      deltaCostMax = -W.costMax;
      deltaTimeMin = -W.hoursMin;
      deltaTimeMax = -W.hoursMax;
    } else if (scenarioType === "increase_demand") {
      const useBlocking = deltaHoursNum >= 20;
      const R = useBlocking ? B : W;
      deltaFragility = useBlocking ? FRAGILITY_PTS.BLOCKING : FRAGILITY_PTS.WARNING;
      deltaCostMin = R.costMin;
      deltaCostMax = R.costMax;
      deltaTimeMin = R.hoursMin;
      deltaTimeMax = R.hoursMax;
    } else {
      const n = Math.min(4, peopleRemovedNum);
      deltaFragility = Math.min(100, n * FRAGILITY_PTS.BLOCKING);
      deltaCostMin = n * B.costMin;
      deltaCostMax = n * B.costMax;
      deltaTimeMin = n * B.hoursMin;
      deltaTimeMax = n * B.hoursMax;
    }

    const afterFragility = Math.min(100, Math.max(0, currentFragility + deltaFragility));
    const afterCostMin = Math.max(0, currentCostMin + deltaCostMin);
    const afterCostMax = Math.max(0, currentCostMax + deltaCostMax);
    const afterTimeMin = Math.max(0, currentTimeMin + deltaTimeMin);
    const afterTimeMax = Math.max(0, currentTimeMax + deltaTimeMax);
    const afterTimeToReadiness = outputs.timeToReadinessWeeks;
    const afterTrainingLoad = outputs.trainingLoad;

    return {
      current: {
        fragility: currentFragility,
        costMin: currentCostMin,
        costMax: currentCostMax,
        timeMin: currentTimeMin,
        timeMax: currentTimeMax,
        timeToReadiness: currentTimeToReadiness,
        trainingLoad: currentTrainingLoad,
      },
      after: {
        fragility: afterFragility,
        costMin: afterCostMin,
        costMax: afterCostMax,
        timeMin: afterTimeMin,
        timeMax: afterTimeMax,
        timeToReadiness: afterTimeToReadiness,
        trainingLoad: afterTrainingLoad,
      },
      delta: {
        fragility: deltaFragility,
        costMin: deltaCostMin,
        costMax: deltaCostMax,
        timeMin: deltaTimeMin,
        timeMax: deltaTimeMax,
        timeToReadiness: afterTimeToReadiness - currentTimeToReadiness,
        trainingLoad: afterTrainingLoad,
      },
    };
  }, [blockersCount, outputs.timeToReadinessWeeks, outputs.trainingLoad, scenarioType, peopleRemovedNum, deltaHoursNum]);

  const boardSentence = useMemo(() => {
    const c = comparison.current;
    const a = comparison.after;
    const fragFromTo = c.fragility !== a.fragility ? `Fragility from ${c.fragility} to ${a.fragility}` : "Fragility unchanged";
    const costFromTo = c.costMin !== a.costMin || c.costMax !== a.costMax
      ? `cost exposure from ${formatSekRange(c.costMin, c.costMax)} to ${formatSekRange(a.costMin, a.costMax)}`
      : "cost exposure unchanged";
    const timeFromTo = c.timeToReadiness !== a.timeToReadiness
      ? `; time-to-readiness from ${c.timeToReadiness} wk${c.timeToReadiness !== 1 ? "s" : ""} to ${a.timeToReadiness} wk${a.timeToReadiness !== 1 ? "s" : ""}`
      : "";
    const trainingText = a.trainingLoad !== "—" ? `; training load: ${a.trainingLoad}` : "";
    return `${fragFromTo}; ${costFromTo}${timeFromTo}${trainingText}.`;
  }, [comparison]);

  const recommendedPlan = useMemo((): PlanItem[] => {
    const d = comparison.delta;
    const fragOutcome = d.fragility !== 0
      ? `Fragility Δ ${d.fragility > 0 ? "+" : ""}${d.fragility}. `
      : "";
    const costOutcome = (d.costMin !== 0 || d.costMax !== 0)
      ? `Cost exposure Δ ${d.costMin >= 0 ? "+" : ""}${formatSekRange(d.costMin, d.costMax)}. `
      : "";
    const timeOutcome = (d.timeMin !== 0 || d.timeMax !== 0)
      ? `Time exposure Δ ${d.timeMin >= 0 ? "+" : ""}${formatHoursRange(d.timeMin, d.timeMax)}. `
      : "";
    const readinessOutcome = d.timeToReadiness !== 0
      ? `Time-to-readiness ${d.timeToReadiness >= 0 ? "+" : ""}${d.timeToReadiness} wk. `
      : "";

    if (scenarioType === "add_station") {
      return [
        { title: "Staff station and run trials", owner: "Ops", etaWeeks: 1, outcome: `${fragOutcome}${costOutcome}Station ready for handover.` },
        { title: "Sign-off certifications", owner: "Supervisor", etaWeeks: 1, outcome: `Readiness in ${outputs.timeToReadinessWeeks} wk. ${readinessOutcome}` },
        { title: "Plan level upgrades for station", owner: "Ops", etaWeeks: 2, outcome: `${outputs.trainingLoad}. ${timeOutcome}` },
        { title: "Review fragility and cost after go-live", owner: "Ops", etaWeeks: 3, outcome: `${fragOutcome}${costOutcome}` },
      ];
    }
    if (scenarioType === "increase_demand") {
      return [
        { title: "Confirm shift coverage for extra hours", owner: "Supervisor", etaWeeks: 1, outcome: `${fragOutcome}${costOutcome}` },
        { title: "Assign capacity or overtime", owner: "Ops", etaWeeks: 1, outcome: `${timeOutcome}${readinessOutcome}` },
        { title: "Schedule training for demand increase", owner: "Ops", etaWeeks: Math.min(4, outputs.timeToReadinessWeeks), outcome: `${outputs.trainingLoad}. Readiness in ${outputs.timeToReadinessWeeks} wk.` },
        { title: "Track cost and time exposure", owner: "Ops", etaWeeks: 2, outcome: `${costOutcome}${timeOutcome}` },
        { title: "Recheck blockers before ramp", owner: "Supervisor", etaWeeks: outputs.timeToReadinessWeeks, outcome: `${fragOutcome}${readinessOutcome}` },
      ];
    }
    // remove_capacity
    return [
      { title: "Backfill roster for affected shift", owner: "Ops", etaWeeks: 1, outcome: `${fragOutcome}${costOutcome}` },
      { title: "Confirm coverage and handover", owner: "Supervisor", etaWeeks: 1, outcome: `${timeOutcome}${readinessOutcome}` },
      { title: "Update competence matrix and coverage", owner: "Supervisor", etaWeeks: 2, outcome: `${fragOutcome}${costOutcome}` },
      { title: "Monitor fragility and cost exposure", owner: "Ops", etaWeeks: 3, outcome: `${costOutcome}${timeOutcome}` },
    ];
  }, [scenarioType, comparison.delta, outputs.timeToReadinessWeeks, outputs.trainingLoad]);

  const readiness = useMemo((): ReadinessState => {
    const hasTrainingLoad = outputs.trainingLoad !== "—";
    if (scenarioType === "remove_capacity" && blockersCount > 0) {
      return {
        status: "Blocked",
        bullets: [
          "Coverage gaps on affected shift",
          "Backfill required before execution",
          "Shift risk until roster filled",
        ],
      };
    }
    if (hasTrainingLoad) {
      return {
        status: "Partially ready",
        bullets: [
          "Training needed before full execution",
          "Level upgrades or certifications pending",
          ...(outputs.timeToReadinessWeeks > 2 ? ["Time to readiness " + outputs.timeToReadinessWeeks + " weeks"] : []),
        ].slice(0, 3),
      };
    }
    return {
      status: "Ready",
      bullets: ["No blockers identified."],
    };
  }, [scenarioType, blockersCount, outputs.trainingLoad, outputs.timeToReadinessWeeks]);

  const getScenarioState = useCallback((): ScenarioState => ({
    scenarioType,
    selectedStationId,
    selectedSkillId,
    selectedLine,
    deltaHours,
    peopleRemoved,
    targetShift,
  }), [scenarioType, selectedStationId, selectedSkillId, selectedLine, deltaHours, peopleRemoved, targetShift]);

  const generateDraftTitle = useCallback((state: ScenarioState): string => {
    const typeLabel = SCENARIO_TYPES.find((t) => t.id === state.scenarioType)?.label ?? state.scenarioType;
    const shift = state.targetShift || "—";
    if (state.scenarioType === "add_station") {
      const station = stations.find((s) => s.id === state.selectedStationId);
      const name = station?.station_name || station?.station_code || state.selectedStationId || "Station";
      return `Add station – ${name} (${shift})`;
    }
    if (state.scenarioType === "increase_demand") {
      const line = state.selectedLine || "Line";
      const h = state.deltaHours ? `+${state.deltaHours}h` : "";
      return `Increase demand – ${line} ${h} (${shift})`;
    }
    if (state.scenarioType === "remove_capacity") {
      const line = state.selectedLine || "Line";
      const n = state.peopleRemoved ? `−${state.peopleRemoved}` : "";
      return `Remove capacity – ${line} ${n} (${shift})`;
    }
    return `${typeLabel} (${shift})`;
  }, [stations]);

  const applyScenarioState = useCallback((state: ScenarioState) => {
    setScenarioType(state.scenarioType);
    setSelectedStationId(state.selectedStationId ?? "");
    setSelectedSkillId(state.selectedSkillId ?? "");
    setSelectedLine(state.selectedLine ?? "");
    setDeltaHours(state.deltaHours ?? "10");
    setPeopleRemoved(state.peopleRemoved ?? "2");
    setTargetShift(state.targetShift ?? SHIFT_OPTIONS[0]);
  }, []);

  const saveDraft = useCallback(() => {
    const state = getScenarioState();
    const title = generateDraftTitle(state);
    const draft: SavedDraft = { ...state, timestamp: Date.now(), title };
    setDrafts((prev) => {
      const next = [draft, ...prev.filter((d) => d.timestamp !== draft.timestamp)].slice(0, MAX_DRAFTS);
      saveDraftsToStorage(next);
      return next;
    });
  }, [getScenarioState, generateDraftTitle]);

  const loadDraft = useCallback((draft: SavedDraft) => {
    applyScenarioState(draft);
  }, [applyScenarioState]);

  const deleteDraft = useCallback((timestamp: number) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.timestamp !== timestamp);
      saveDraftsToStorage(next);
      return next;
    });
  }, []);

  const buildShareUrl = useCallback(() => {
    const state = getScenarioState();
    const params = scenarioStateToParams(state);
    const base = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return `${base}?${params.toString()}`;
  }, [getScenarioState]);

  const copyShareLink = useCallback(() => {
    const url = buildShareUrl();
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url);
    }
  }, [buildShareUrl]);

  const filterBar = (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 className="ds-h1" data-testid="heading-scenario-builder">
          Scenario Builder
        </h1>
        <p className="ds-meta mt-1">Strategic Planning · Preview (data-backed)</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={saveDraft} data-testid="btn-save-draft">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save draft
        </Button>
        <Button variant="outline" size="sm" onClick={copyShareLink} data-testid="btn-share-link">
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          Share link
        </Button>
      </div>
    </header>
  );

  const stationOptions = stations;
  const skillOptions = skills;
  const lineOptions = lines;

  return (
    <PageFrame filterBar={filterBar}>
      <div className="max-w-2xl">
        <div className="ds-card p-0 overflow-hidden" data-testid="scenario-card">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Scenario
            </p>
          </div>

          <div className="p-4 space-y-4 border-b border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Type</p>
            <Select
              value={scenarioType}
              onValueChange={(v) => setScenarioType(v as typeof scenarioType)}
            >
              <SelectTrigger className="w-full max-w-xs" data-testid="select-scenario-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIO_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    ({t.short}) {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {scenarioType === "add_station" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Station</Label>
                  <Select
                    value={selectedStationId || "_none"}
                    onValueChange={(v) => setSelectedStationId(v === "_none" ? "" : v)}
                    disabled={loadingStations}
                  >
                    <SelectTrigger className="w-full max-w-xs" data-testid="select-station">
                      <SelectValue placeholder={loadingStations ? "Loading…" : "Select station"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {stationOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.station_name || s.station_code} ({s.line})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Skill (required at station)</Label>
                  <Select
                    value={selectedSkillId || "_none"}
                    onValueChange={(v) => setSelectedSkillId(v === "_none" ? "" : v)}
                    disabled={loadingSkills}
                  >
                    <SelectTrigger className="w-full max-w-xs" data-testid="select-skill">
                      <SelectValue placeholder={loadingSkills ? "Loading…" : "Select skill"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {skillOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code ?? s.name} {s.name && s.code !== s.name ? `(${s.name})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Target shift</Label>
                  <Select value={targetShift} onValueChange={setTargetShift}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scenarioType === "increase_demand" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Line / area</Label>
                  <Select
                    value={selectedLine || "_none"}
                    onValueChange={(v) => setSelectedLine(v === "_none" ? "" : v)}
                    disabled={loadingLines}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder={loadingLines ? "Loading…" : "Select line"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {lineOptions.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Delta hours</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={deltaHours}
                    onChange={(e) => setDeltaHours(e.target.value)}
                    className="w-full max-w-[120px]"
                    data-testid="input-delta-hours"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Target shift</Label>
                  <Select value={targetShift} onValueChange={setTargetShift}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {scenarioType === "remove_capacity" && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Line / area</Label>
                  <Select
                    value={selectedLine || "_none"}
                    onValueChange={(v) => setSelectedLine(v === "_none" ? "" : v)}
                    disabled={loadingLines}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue placeholder={loadingLines ? "Loading…" : "Select line"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {lineOptions.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Number of people removed</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={peopleRemoved}
                    onChange={(e) => setPeopleRemoved(e.target.value)}
                    className="w-full max-w-[120px]"
                    data-testid="input-people-removed"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Target shift</Label>
                  <Select value={targetShift} onValueChange={setTargetShift}>
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>

          <div className="p-4 space-y-4 bg-muted/10">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Outputs (estimate)
            </p>
            <p className="text-sm text-foreground border-l-2 border-primary/50 pl-3 py-1" data-testid="board-sentence">
              {boardSentence}
            </p>
            {loadingRequirements && selectedStationId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading requirements…
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Projected fragility Δ
                </p>
                <p
                  className={`font-semibold tabular-nums mt-0.5 ${
                    comparison.delta.fragility > 0
                      ? "text-amber-600 dark:text-amber-400"
                      : comparison.delta.fragility < 0
                        ? "text-green-600 dark:text-green-400"
                        : ""
                  }`}
                >
                  {comparison.delta.fragility > 0 ? "+" : ""}
                  {comparison.delta.fragility}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Estimated cost range Δ
                </p>
                <p className="font-semibold tabular-nums mt-0.5">
                  {comparison.delta.costMin >= 0 ? "+" : ""}{formatSekRange(comparison.delta.costMin, comparison.delta.costMax)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Time to readiness
                </p>
                <p className="font-semibold tabular-nums mt-0.5">
                  {comparison.after.timeToReadiness} week
                  {comparison.after.timeToReadiness !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Training load
                </p>
                <p className="font-semibold mt-0.5">{comparison.after.trainingLoad}</p>
              </div>
            </div>

            <div className="rounded border border-border bg-background/50 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Comparison (Current → After → Δ)
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 pr-4 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Metric</th>
                      <th className="text-right py-2 px-2 tabular-nums text-[10px] font-medium text-muted-foreground">Current</th>
                      <th className="text-right py-2 px-2 tabular-nums text-[10px] font-medium text-muted-foreground">After</th>
                      <th className="text-right py-2 px-2 tabular-nums text-[10px] font-medium text-muted-foreground">Δ</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Fragility exposure</td>
                      <td className="text-right px-2 tabular-nums">{comparison.current.fragility}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.after.fragility}</td>
                      <td className={`text-right px-2 tabular-nums ${comparison.delta.fragility > 0 ? "text-amber-600 dark:text-amber-400" : comparison.delta.fragility < 0 ? "text-green-600 dark:text-green-400" : ""}`}>
                        {comparison.delta.fragility > 0 ? "+" : ""}{comparison.delta.fragility}
                      </td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Cost exposure range</td>
                      <td className="text-right px-2 tabular-nums">{formatSekRange(comparison.current.costMin, comparison.current.costMax)}</td>
                      <td className="text-right px-2 tabular-nums">{formatSekRange(comparison.after.costMin, comparison.after.costMax)}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.delta.costMin >= 0 ? "+" : ""}{formatSekRange(comparison.delta.costMin, comparison.delta.costMax)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Time exposure range</td>
                      <td className="text-right px-2 tabular-nums">{formatHoursRange(comparison.current.timeMin, comparison.current.timeMax)}</td>
                      <td className="text-right px-2 tabular-nums">{formatHoursRange(comparison.after.timeMin, comparison.after.timeMax)}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.delta.timeMin >= 0 ? "+" : ""}{formatHoursRange(comparison.delta.timeMin, comparison.delta.timeMax)}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Time-to-readiness</td>
                      <td className="text-right px-2 tabular-nums">{comparison.current.timeToReadiness} wk{comparison.current.timeToReadiness !== 1 ? "s" : ""}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.after.timeToReadiness} wk{comparison.after.timeToReadiness !== 1 ? "s" : ""}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.delta.timeToReadiness >= 0 ? "+" : ""}{comparison.delta.timeToReadiness} wk{Math.abs(comparison.delta.timeToReadiness) !== 1 ? "s" : ""}</td>
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-2 pr-4">Training load</td>
                      <td className="text-right px-2 tabular-nums">{comparison.current.trainingLoad}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.after.trainingLoad}</td>
                      <td className="text-right px-2 tabular-nums">{comparison.after.trainingLoad}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                Top blockers
              </p>
              <ul className="text-sm space-y-0.5">
                {outputs.topBlockers.map((b, i) => (
                  <li key={i} className="text-muted-foreground">
                    · {b}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="ds-card p-0 overflow-hidden mb-4" data-testid="execution-readiness-section">
          <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Execution readiness
            </p>
            <span
              className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                readiness.status === "Ready"
                  ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : readiness.status === "Partially ready"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              }`}
            >
              {readiness.status}
            </span>
          </div>
          <div className="px-4 py-3">
            <ul className="text-sm text-muted-foreground space-y-0.5">
              {readiness.bullets.map((b, i) => (
                <li key={i}>· {b}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ds-card p-0 overflow-hidden mb-6" data-testid="recommended-plan-section">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Recommended plan (estimate)
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">3–5 actions based on scenario and comparison deltas</p>
          </div>
          <div className="p-4">
            <ul className="space-y-4">
              {recommendedPlan.map((item, i) => (
                <li key={i} className="rounded border border-border/60 bg-muted/5 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <p className="font-medium text-sm">{item.title}</p>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      {item.owner}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-1">
                    ETA: {item.etaWeeks} week{item.etaWeeks !== 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.outcome}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground mt-2 mb-4">
          Link contains scenario inputs only (no employee data).
        </p>

        <div className="ds-card p-0 overflow-hidden mb-6" data-testid="drafts-section">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Drafts</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Saved in this browser (max {MAX_DRAFTS})</p>
          </div>
          <div className="p-4">
            {drafts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No drafts saved yet. Use “Save draft” to store the current scenario.</p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((draft) => (
                  <li
                    key={draft.timestamp}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 bg-muted/10 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{draft.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(draft.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="sm" onClick={() => loadDraft(draft)} data-testid={`draft-load-${draft.timestamp}`}>
                        Load
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => deleteDraft(draft.timestamp)} data-testid={`draft-delete-${draft.timestamp}`}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
