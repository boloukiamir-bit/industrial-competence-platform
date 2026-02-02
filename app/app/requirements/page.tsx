"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useOrg } from "@/hooks/useOrg";
import { OrgGuard } from "@/components/OrgGuard";
import { Badge } from "@/components/ui/badge";
import { withDevBearer } from "@/lib/devBearer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Settings2 } from "lucide-react";
import { getLineName } from "@/lib/lineOverviewLineNames";

type Station = { id: string; code: string; name: string; line: string };
type Skill = { skill_id: string; code: string; name: string; category: string };
type Requirement = { station_id: string; skill_id: string; required_level: number };
type HealthRow = {
  station_id?: string;
  station_code: string;
  station_name: string;
  eligible_final: number;
  risk_tier: string | null;
  req_status: string;
  req_skill_count: number;
  data_maturity: string | null;
};

type ApiResponse = {
  lines: string[];
  stations: Station[];
  skills: Skill[];
  requirements: Requirement[];
  health: HealthRow[];
};

function groupByCategory(skills: Skill[]): Map<string, Skill[]> {
  const map = new Map<string, Skill[]>();
  for (const s of skills) {
    const cat = s.category || "OTHER";
    const list = map.get(cat) || [];
    list.push(s);
    map.set(cat, list);
  }
  for (const [, list] of map) {
    list.sort((a, b) => a.code.localeCompare(b.code));
  }
  return map;
}

function requirementsToMap(requirements: Requirement[]): Record<string, Set<string>> {
  const map: Record<string, Set<string>> = {};
  for (const r of requirements) {
    let set = map[r.station_id];
    if (!set) {
      set = new Set();
      map[r.station_id] = set;
    }
    set.add(r.skill_id);
  }
  return map;
}

function healthToMap(health: HealthRow[], stations: Station[]): Record<string, HealthRow> {
  const byId: Record<string, HealthRow> = {};
  for (const h of health) {
    const sid = h.station_id ?? stations.find((s) => s.code === h.station_code)?.id;
    if (sid) byId[sid] = { ...h, station_id: sid };
  }
  return byId;
}

export default function RequirementsPage() {
  const searchParams = useSearchParams();
  const initialLine = searchParams.get("line")?.trim() || "";
  const { toast, toasts } = useToast();
  const { isAdminOrHr } = useOrg();

  const [line, setLine] = useState(initialLine || "BEA");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [localReqs, setLocalReqs] = useState<Record<string, Set<string>>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [localHealth, setLocalHealth] = useState<Record<string, HealthRow>>({});
  const lastAppliedAtRef = useRef<Record<string, string>>({});
  const loadErrorToastedRef = useRef(false);
  const [hardBlockModal, setHardBlockModal] = useState<{
    stationId: string;
    skillId: string;
    prevChecked: boolean;
    before: HealthRow | null;
    after: HealthRow | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    loadErrorToastedRef.current = false;
    try {
      const params = new URLSearchParams();
      if (line) params.set("line", line);
      if (searchDebounced.trim()) params.set("search", searchDebounced.trim());
      const res = await fetch(`/api/requirements?${params}`, {
        cache: "no-store",
        credentials: "include",
        headers: withDevBearer(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body?.error ?? body?.message) || "Failed to load");
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setLocalReqs(requirementsToMap(json.requirements || []));
      setLocalHealth(healthToMap(json.health || [], json.stations || []));
      if (!selectedStation && json.stations?.length) {
        setSelectedStation(json.stations[0]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load";
      setError(msg);
      if (!loadErrorToastedRef.current) {
        loadErrorToastedRef.current = true;
        toast({ title: msg, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  }, [line, searchDebounced]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const pendingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const toggleRequirement = useCallback(
    async (stationId: string, skillId: string, prevChecked: boolean, newChecked: boolean) => {
      const key = `${stationId}:${skillId}`;
      if (pendingRef.current.has(key)) {
        toast({ title: "Please wait for the previous change to save" });
        return;
      }

      setPending((p) => new Set(p).add(key));
      setLocalReqs((prev) => {
        const next = { ...prev };
        const set = new Set(next[stationId] || []);
        if (newChecked) set.add(skillId);
        else set.delete(skillId);
        next[stationId] = set;
        return next;
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("[DEV requirements] toggle", { stationId, skillId, newChecked });
      }

      try {
        const res = await fetch("/api/requirements/upsert", {
          method: "POST",
          headers: withDevBearer({ "Content-Type": "application/json" }),
          credentials: "include",
          body: JSON.stringify({
            station_id: stationId,
            skill_id: skillId,
            required: newChecked,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error((body?.error ?? body?.message) || "Failed to update");
        }
        const serverTime = body.server_time as string | undefined;
        const sid = (body.after as HealthRow | null)?.station_id ?? stationId;
        const lastAt = lastAppliedAtRef.current[sid];
        if (serverTime && lastAt && serverTime < lastAt) {
          return;
        }
        if (serverTime) {
          lastAppliedAtRef.current = { ...lastAppliedAtRef.current, [sid]: serverTime };
        }
        const after = body.after as HealthRow | null;
        const before = body.before as HealthRow | null;
        if (sid && after) {
          setLocalHealth((prev) => ({
            ...prev,
            [sid]: { ...after, station_id: sid },
          }));
        }
        if (body.hardBlock) {
          setHardBlockModal({
            stationId,
            skillId,
            prevChecked,
            before,
            after,
          });
          toast({ title: "Updated requirements" });
        } else {
          if (body.danger) {
            toast({
              title: "Fragile coverage",
              description: `Only ${body.after?.eligible_final ?? 0} eligible. Consider adding skills or headcount.`,
            });
          } else {
            toast({ title: "Updated requirements" });
          }
        }
        await loadData();
      } catch (err) {
        setLocalReqs((prev) => {
          const next = { ...prev };
          const set = new Set(next[stationId] || []);
          if (prevChecked) set.add(skillId);
          else set.delete(skillId);
          next[stationId] = set;
          return next;
        });
        toast({
          title: err instanceof Error ? err.message : "Update failed",
          variant: "destructive",
        });
      } finally {
        setPending((p) => {
          const next = new Set(p);
          next.delete(key);
          return next;
        });
      }
    },
    [toast, loadData]
  );

  const handleHardBlockRevert = useCallback(async () => {
    if (!hardBlockModal) return;
    const { stationId, skillId, prevChecked, before } = hardBlockModal;
    setHardBlockModal(null);

    setLocalReqs((prev) => {
      const next = { ...prev };
      const set = new Set(next[stationId] || []);
      if (prevChecked) set.add(skillId);
      else set.delete(skillId);
      next[stationId] = set;
      return next;
    });

    const key = `${stationId}:${skillId}`;
    setPending((p) => new Set(p).add(key));
    try {
      const res = await fetch("/api/requirements/upsert", {
        method: "POST",
        headers: withDevBearer({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          station_id: stationId,
          skill_id: skillId,
          required: prevChecked,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body?.error ?? body?.message) || "Failed to revert");
      const serverTime = body.server_time as string | undefined;
      const sid = (body.after as HealthRow | null)?.station_id ?? before?.station_id ?? stationId;
      const lastAt = lastAppliedAtRef.current[sid];
      if (serverTime && lastAt && serverTime < lastAt) {
        return;
      }
      if (serverTime && sid) {
        lastAppliedAtRef.current = { ...lastAppliedAtRef.current, [sid]: serverTime };
      }
      if (sid) {
        const after = body.after as HealthRow | null;
        const healthRow = after ?? before;
        if (healthRow) {
          setLocalHealth((prev) => ({
            ...prev,
            [sid]: { ...healthRow, station_id: sid },
          }));
        }
      }
      toast({ title: "Reverted" });
    } catch (err) {
      setLocalReqs((prev) => {
        const next = { ...prev };
        const set = new Set(next[stationId] || []);
        if (!prevChecked) set.add(skillId);
        else set.delete(skillId);
        next[stationId] = set;
        return next;
      });
      toast({ title: "Revert failed", variant: "destructive" });
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }, [hardBlockModal, toast]);

  const handleHardBlockKeep = useCallback(() => {
    setHardBlockModal(null);
  }, []);

  const skillsByCategory = useMemo(
    () => (data?.skills ? groupByCategory(data.skills) : new Map()),
    [data?.skills]
  );

  const selectedReqs = selectedStation ? (localReqs[selectedStation.id] ?? new Set<string>()) : new Set<string>();
  const health = selectedStation ? localHealth[selectedStation.id] : null;

  return (
    <OrgGuard>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Station Requirements
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Station list */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex gap-2">
              <Select value={line} onValueChange={setLine}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Line" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.lines || []).map((l) => (
                    <SelectItem key={l} value={l}>
                      {getLineName(l)} ({l})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search stations..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              {loading ? (
                <div className="p-4 text-sm text-gray-500">Loading...</div>
              ) : error ? (
                <div className="p-4 text-sm text-red-600 dark:text-red-400">{error}</div>
              ) : !data?.stations?.length ? (
                <div className="p-4 text-sm text-gray-500">No stations found</div>
              ) : (
                <ul className="max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {data.stations.map((st) => (
                    <li key={st.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedStation(st)}
                        className={`w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                          selectedStation?.id === st.id
                            ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-600"
                            : ""
                        }`}
                      >
                        <span className="text-sm font-medium truncate">{st.name || st.code}</span>
                        <RequirementsBadge health={localHealth[st.id]} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Right: Requirements panel */}
          <div className="lg:col-span-2">
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-gray-500" />
                <h2 className="font-medium text-gray-900 dark:text-white">Requirements</h2>
                {selectedStation && health && (
                  <RequirementsBadge health={health} className="ml-auto" />
                )}
              </div>
              {!isAdminOrHr && selectedStation && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
                  Read-only (admin/hr only)
                </div>
              )}
              <div className="p-4 max-h-[500px] overflow-y-auto">
                {!selectedStation ? (
                  <p className="text-sm text-gray-500">
                    Select a station from the list to edit requirements.
                  </p>
                ) : skillsByCategory.size === 0 ? (
                  <p className="text-sm text-gray-500">
                    No skills in catalog. Add skills in Admin or Competence Matrix.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {[...skillsByCategory.entries()].map(([category, skills]) => (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                          {category}
                        </h3>
                        <div className="space-y-2">
                          {skills.map((skill: Skill) => {
                            const checked = selectedReqs.has(skill.skill_id);
                            const key = `${selectedStation.id}:${skill.skill_id}`;
                            const isPending = pending.has(key);
                            return (
                              <label
                                key={skill.skill_id}
                                className="flex items-center gap-3 py-1.5 cursor-pointer group"
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) =>
                                    toggleRequirement(
                                      selectedStation.id,
                                      skill.skill_id,
                                      checked,
                                      c === true
                                    )
                                  }
                                  disabled={isPending || !isAdminOrHr}
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                  {skill.name} ({skill.code})
                                </span>
                                {isPending && (
                                  <span className="text-xs text-gray-400">Saving...</span>
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {toasts.length > 0 && (
          <div className="fixed bottom-4 right-4 z-50 space-y-2">
            {toasts.map((t) => (
              <div
                key={t.id}
                className={`rounded-lg border px-4 py-3 shadow-lg ${
                  t.variant === "destructive"
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/80"
                    : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                }`}
              >
                {t.title && <p className="font-medium text-sm">{t.title}</p>}
                {t.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{t.description}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!hardBlockModal} onOpenChange={(open) => !open && setHardBlockModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>NO COVERAGE</DialogTitle>
              <DialogDescription>
                This change results in NO COVERAGE (0 eligible). Confirm to keep or revert?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={handleHardBlockRevert}>
                Revert
              </Button>
              <Button onClick={handleHardBlockKeep}>Keep</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </OrgGuard>
  );
}

function RequirementsBadge({
  health,
  className,
}: {
  health?: HealthRow | null;
  className?: string;
}) {
  if (!health) return null;
  const parts = [
    health.req_status,
    `req:${health.req_skill_count}`,
    health.eligible_final != null ? `eligible:${health.eligible_final}` : null,
    health.risk_tier,
    health.eligible_final != null && health.eligible_final <= 3 ? "Fragile" : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return (
    <Badge variant="outline" size="sm" className={className}>
      {parts.join(" · ")}
    </Badge>
  );
}
