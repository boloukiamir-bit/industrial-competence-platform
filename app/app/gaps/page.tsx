"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertTriangle, 
  Download, 
  TrendingUp, 
  Users, 
  Lightbulb,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { computeLineGaps, type LineOverviewData } from "@/services/gapEngine";

interface GapRow {
  employee: string;
  employeeId: string;
  skill: string;
  skillCode: string;
  requiredLevel: number;
  currentLevel: number;
  severity: "OK" | "GAP" | "RISK";
  suggestedAction: "No action" | "Train" | "Swap" | "Buddy";
}

interface StaffingGapRow {
  stationOrMachine: string;
  stationOrMachineCode: string;
  required: number;
  assigned: number;
  staffingGap: number;
  competenceStatus: "OK" | "GAP" | "RISK" | "NO-GO";
}

interface GapSummary {
  employeesAtRisk: number;
  topMissingSkills: { skill: string; count: number }[];
  fastestFix: string | null;
}

const SHIFT_OPTIONS = ["Day", "Evening", "Night"];


function computeSummary(gaps: GapRow[]): GapSummary {
  const riskEmployees = new Set(
    gaps.filter(g => g.severity === "RISK" || g.severity === "GAP").map(g => g.employeeId)
  );
  
  const skillCounts: Record<string, number> = {};
  gaps.filter(g => g.severity !== "OK").forEach(g => {
    skillCounts[g.skill] = (skillCounts[g.skill] || 0) + 1;
  });
  
  const topMissingSkills = Object.entries(skillCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([skill, count]) => ({ skill, count }));

  const swapCandidate = gaps.find(g => g.suggestedAction === "Swap");
  const fastestFix = swapCandidate 
    ? `Swap ${swapCandidate.employee} to cover ${swapCandidate.skill}`
    : gaps.length > 0 ? "Schedule training for highest priority gaps" : null;

  return {
    employeesAtRisk: riskEmployees.size,
    topMissingSkills,
    fastestFix,
  };
}

function getSeverityBadge(severity: "OK" | "GAP" | "RISK") {
  switch (severity) {
    case "OK":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">OK</Badge>;
    case "GAP":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">GAP</Badge>;
    case "RISK":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">RISK</Badge>;
  }
}

function exportToCSV(
  gaps: GapRow[], 
  staffingGaps: StaffingGapRow[], 
  dateStr: string
) {
  const headers = [
    "Station/Machine", 
    "Required", 
    "Assigned", 
    "Staffing Gap", 
    "Competence Status",
    "Employee",
    "Skill", 
    "Required Level", 
    "Current Level", 
    "Severity", 
    "Suggested Action"
  ];
  
  // Create rows: one per staffing gap, with competence gaps as additional rows
  const rows: string[][] = [];
  
  staffingGaps.forEach(sg => {
    // First row: staffing gap info
    rows.push([
      sg.stationOrMachine,
      sg.required.toString(),
      sg.assigned.toString(),
      sg.staffingGap.toString(),
      sg.competenceStatus,
      "", // Employee
      "", // Skill
      "", // Required Level
      "", // Current Level
      "", // Severity
      "", // Suggested Action
    ]);
    
    // Add competence gaps for this station/machine
    const relatedGaps = gaps.filter(g => 
      g.employeeId && staffingGaps.some(s => s.stationOrMachineCode === sg.stationOrMachineCode)
    );
    relatedGaps.forEach(g => {
      rows.push([
        "", // Station/Machine (same as above)
        "", // Required (staffing)
        "", // Assigned (staffing)
        "", // Staffing Gap
        "", // Competence Status (same as above)
        g.employee,
        g.skill,
        g.requiredLevel.toString(),
        g.currentLevel.toString(),
        g.severity,
        g.suggestedAction,
      ]);
    });
  });
  
  // If no staffing gaps but there are competence gaps, add them
  if (staffingGaps.length === 0 && gaps.length > 0) {
    gaps.forEach(g => {
      rows.push([
        "", // Station/Machine
        "", // Required
        "", // Assigned
        "", // Staffing Gap
        "", // Competence Status
        g.employee,
        g.skill,
        g.requiredLevel.toString(),
        g.currentLevel.toString(),
        g.severity,
        g.suggestedAction,
      ]);
    });
  }
  
  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(","))
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `gaps-${dateStr}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function GapsPage() {
  const [line, setLine] = useState<string>("");
  const [shift, setShift] = useState<string>("");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gaps, setGaps] = useState<GapRow[]>([]);
  const [staffingGaps, setStaffingGaps] = useState<StaffingGapRow[]>([]);
  const [lines, setLines] = useState<string[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  
  const lineOptions = (lines ?? []).filter(Boolean);
  
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 1);
  const dateStr = targetDate.toISOString().slice(0, 10);
  const formattedDate = targetDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const summary = useMemo(() => computeSummary(gaps), [gaps]);

  // Load lines from API (canonical: public.stations) and get active_org_id for generate
  useEffect(() => {
    async function loadLines() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setLines([]);
          setActiveOrgId(null);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("active_org_id")
          .eq("id", session.user.id)
          .single();

        if (profileError || !profile?.active_org_id) {
          setLines([]);
          setActiveOrgId(null);
          return;
        }

        setActiveOrgId(profile.active_org_id as string);

        const res = await fetch("/api/lines", { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(json.lines)) {
          setLines(json.lines);
          if (json.source) console.debug("[gaps lines] source:", json.source);
        } else {
          setLines([]);
        }
      } catch (error) {
        console.error("Error loading lines:", error);
        setLines([]);
        setActiveOrgId(null);
      }
    }

    loadLines();
  }, []);

  async function handleGenerate() {
    if (!line || !activeOrgId) return;
    
    setLoading(true);
    setGaps([]);
    setStaffingGaps([]);
    
    try {
      const shiftType = shift && shift !== "all" ? shift : "Day";
      const shiftParam = shiftType.toLowerCase();
      
      // 1. Fetch demand data from Line Overview endpoint (same as Line Overview uses)
      const response = await fetch(`/api/line-overview?date=${dateStr}&shift=${shiftParam}`);
      
      if (!response.ok) {
        console.error("Failed to fetch demand data:", response.statusText);
        setGenerated(true);
        setLoading(false);
        return;
      }
      
      const lineOverviewData: LineOverviewData = await response.json();
      
      // 2. Compute gaps using the shared gap engine
      const result = await computeLineGaps({
        orgId: activeOrgId,
        line,
        date: dateStr,
        shiftType,
        supabaseClient: supabase,
        lineOverviewData,
      });
      
      // 3. Transform results to match UI structure
      const staffingGapRows: StaffingGapRow[] = result.machineRows.map(mr => ({
        stationOrMachine: mr.stationOrMachine,
        stationOrMachineCode: mr.stationOrMachineCode,
        required: mr.required,
        assigned: mr.assigned,
        staffingGap: mr.staffingGap,
        competenceStatus: mr.competenceStatus,
      }));
      
      const gapRows: GapRow[] = result.machineRows.flatMap(mr => mr.competenceGaps);
      
      setStaffingGaps(staffingGapRows);
      setGaps(gapRows);
      setGenerated(true);
    } catch (error) {
      console.error("Error generating gaps:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    exportToCSV(gaps, staffingGaps, dateStr);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" data-testid="heading-tomorrows-gaps">
          Tomorrow's Gaps
        </h1>
        <p className="text-sm text-muted-foreground" data-testid="text-target-date">
          Target date: {formattedDate}
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Line</label>
              <Select value={line} onValueChange={setLine}>
                <SelectTrigger data-testid="select-line">
                  <SelectValue placeholder="Select line..." />
                </SelectTrigger>
                <SelectContent>
                  {lineOptions.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">
                      No lines found for this organization
                    </div>
                  ) : (
                    lineOptions.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Shift</label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger data-testid="select-shift">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleGenerate} 
              disabled={!line || loading}
              className="min-w-[140px]"
              data-testid="button-generate-gaps"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Generate Gaps
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {generated && (
        <>
          <Card className="mb-6 border-l-4 border-l-primary" data-testid="card-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                What to Fix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/30">
                    <Users className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid="text-employees-at-risk">
                      {summary.employeesAtRisk}
                    </p>
                    <p className="text-sm text-muted-foreground">Employees at Risk</p>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm font-medium mb-2">Top Missing Skills</p>
                  <div className="space-y-1" data-testid="list-missing-skills">
                    {summary.topMissingSkills.length > 0 ? (
                      summary.topMissingSkills.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span>{item.skill}</span>
                          <Badge variant="outline" className="text-xs">{item.count}</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No gaps found</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30">
                    <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Fastest Fix</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-fastest-fix">
                      {summary.fastestFix || "No immediate action needed"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Gaps Table</h2>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={staffingGaps.length === 0 && gaps.length === 0}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="gaps-table">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Station/Machine
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Required
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Assigned
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Staffing Gap
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Competence Status
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Employee
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Skill
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Required Level
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Current Level
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Severity
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Suggested Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {staffingGaps.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-muted-foreground" data-testid="no-gaps-message">
                        {generated 
                          ? "No demand configured for this line/date/shift."
                          : "Select a line and click 'Generate Gaps' to analyze tomorrow's skill coverage."}
                      </td>
                    </tr>
                  ) : (
                    staffingGaps.map((sg, sgIndex) => {
                      // For now, show all competence gaps (they're already filtered by assigned employees)
                      // In a production system, you'd have better machine-to-station mapping
                      const relatedGaps = gaps; // Show all gaps for simplicity
                      
                      const rows: JSX.Element[] = [];
                      
                      // First row: staffing gap info
                      rows.push(
                        <tr 
                          key={`staffing-${sg.stationOrMachineCode}-${sgIndex}`}
                          className={`border-b ${sgIndex % 2 === 0 ? "bg-muted/20" : ""}`}
                          data-testid={`row-staffing-${sgIndex}`}
                        >
                          <td className="p-3 text-sm font-medium">{sg.stationOrMachine}</td>
                          <td className="p-3 text-sm text-center">{sg.required}</td>
                          <td className="p-3 text-sm text-center">{sg.assigned}</td>
                          <td className="p-3 text-sm text-center font-medium">
                            {sg.staffingGap > 0 ? (
                              <span className="text-red-600 dark:text-red-400">{sg.staffingGap}</span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {sg.competenceStatus === "NO-GO" ? (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">NO-GO</Badge>
                            ) : sg.competenceStatus === "RISK" ? (
                              <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-800">RISK</Badge>
                            ) : sg.competenceStatus === "GAP" ? (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800">GAP</Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">OK</Badge>
                            )}
                          </td>
                          <td colSpan={6} className="p-3 text-sm text-muted-foreground">
                            {relatedGaps.length === 0 ? "No competence gaps" : `${relatedGaps.length} competence gap(s)`}
                          </td>
                        </tr>
                      );
                      
                      // Add competence gap rows (limit to first few to avoid clutter)
                      relatedGaps.slice(0, 5).forEach((gap, gapIndex) => {
                        rows.push(
                          <tr 
                            key={`gap-${sg.stationOrMachineCode}-${gap.employeeId}-${gap.skillCode}-${gapIndex}`}
                            className={`border-b ${sgIndex % 2 === 0 ? "bg-muted/10" : ""}`}
                            data-testid={`row-gap-${sgIndex}-${gapIndex}`}
                          >
                            <td className="p-3 text-sm text-muted-foreground pl-6">↳</td>
                            <td colSpan={4}></td>
                            <td className="p-3 text-sm font-medium">{gap.employee}</td>
                            <td className="p-3 text-sm">
                              <div>{gap.skill}</div>
                              <div className="text-xs text-muted-foreground">{gap.skillCode}</div>
                            </td>
                            <td className="p-3 text-sm text-center">{gap.requiredLevel}</td>
                            <td className="p-3 text-sm text-center">{gap.currentLevel}</td>
                            <td className="p-3 text-center">{getSeverityBadge(gap.severity)}</td>
                            <td className="p-3 text-sm">{gap.suggestedAction}</td>
                          </tr>
                        );
                      });
                      
                      if (relatedGaps.length > 5) {
                        rows.push(
                          <tr 
                            key={`more-gaps-${sg.stationOrMachineCode}`}
                            className={`border-b ${sgIndex % 2 === 0 ? "bg-muted/10" : ""}`}
                          >
                            <td className="p-3 text-sm text-muted-foreground pl-6">↳</td>
                            <td colSpan={10} className="p-3 text-sm text-muted-foreground italic">
                              ... and {relatedGaps.length - 5} more competence gap(s)
                            </td>
                          </tr>
                        );
                      }
                      
                      return rows;
                    }).flat()
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!generated && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">
              {!line 
                ? "Select a line to view gaps for tomorrow's shift."
                : "Click 'Generate Gaps' to analyze tomorrow's skill coverage."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
