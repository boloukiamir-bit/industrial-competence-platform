"use client";

import { useState, useMemo } from "react";
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

interface GapSummary {
  employeesAtRisk: number;
  topMissingSkills: { skill: string; count: number }[];
  fastestFix: string | null;
}

const demoPositions = ["Pressline 1", "Pressline 2", "Assembly", "Quality Control", "Logistics"];
const demoShifts = ["Day", "Night", "Weekend"];

const demoGapsData: GapRow[] = [
  { employee: "Erik Johansson", employeeId: "E1002", skill: "Truck A1 License", skillCode: "TRUCK_A1", requiredLevel: 2, currentLevel: 0, severity: "RISK", suggestedAction: "Train" },
  { employee: "Karl Andersson", employeeId: "E1004", skill: "Pressline B", skillCode: "PRESS_B", requiredLevel: 2, currentLevel: 0, severity: "RISK", suggestedAction: "Buddy" },
  { employee: "Karl Andersson", employeeId: "E1004", skill: "Safety Basic", skillCode: "SAFETY_BASIC", requiredLevel: 3, currentLevel: 1, severity: "RISK", suggestedAction: "Train" },
  { employee: "Erik Johansson", employeeId: "E1002", skill: "Pressline B", skillCode: "PRESS_B", requiredLevel: 2, currentLevel: 1, severity: "GAP", suggestedAction: "Buddy" },
  { employee: "Erik Johansson", employeeId: "E1002", skill: "Safety Basic", skillCode: "SAFETY_BASIC", requiredLevel: 3, currentLevel: 2, severity: "GAP", suggestedAction: "Train" },
  { employee: "Anna Lindberg", employeeId: "E1001", skill: "Truck A1 License", skillCode: "TRUCK_A1", requiredLevel: 2, currentLevel: 1, severity: "GAP", suggestedAction: "Swap" },
  { employee: "Maria Svensson", employeeId: "E1003", skill: "Truck A1 License", skillCode: "TRUCK_A1", requiredLevel: 3, currentLevel: 2, severity: "GAP", suggestedAction: "Train" },
  { employee: "Anna Lindberg", employeeId: "E1001", skill: "Pressline A", skillCode: "PRESS_A", requiredLevel: 4, currentLevel: 3, severity: "OK", suggestedAction: "No action" },
];

function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("demo") === "true") return true;
  }
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

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

function exportToCSV(gaps: GapRow[], dateStr: string) {
  const headers = ["Employee", "Skill", "Required Level", "Current Level", "Severity", "Suggested Action"];
  const rows = gaps.map(g => [
    g.employee,
    g.skill,
    g.requiredLevel.toString(),
    g.currentLevel.toString(),
    g.severity,
    g.suggestedAction,
  ]);
  
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
  const [position, setPosition] = useState<string>("");
  const [shift, setShift] = useState<string>("");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gaps, setGaps] = useState<GapRow[]>([]);

  const demoMode = isDemoMode();
  
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

  async function handleGenerate() {
    if (!position) return;
    
    setLoading(true);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (demoMode) {
      const filteredGaps = demoGapsData.filter(g => {
        if (shift && shift !== "all") {
          return true;
        }
        return true;
      });
      setGaps(filteredGaps);
    } else {
      setGaps([]);
    }
    
    setGenerated(true);
    setLoading(false);
  }

  function handleExport() {
    exportToCSV(gaps, dateStr);
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
              <label className="text-sm font-medium mb-2 block">Position / Line</label>
              <Select value={position} onValueChange={setPosition}>
                <SelectTrigger data-testid="select-position">
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  {demoPositions.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Shift (optional)</label>
              <Select value={shift} onValueChange={setShift}>
                <SelectTrigger data-testid="select-shift">
                  <SelectValue placeholder="All shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All shifts</SelectItem>
                  {demoShifts.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              onClick={handleGenerate} 
              disabled={!position || loading}
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
              disabled={gaps.length === 0}
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
                      Employee
                    </th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Skill
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Required
                    </th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                      Current
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
                  {gaps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground" data-testid="no-gaps-message">
                        No competence gaps found for tomorrow.
                      </td>
                    </tr>
                  ) : (
                    gaps.map((gap, index) => (
                      <tr 
                        key={`${gap.employeeId}-${gap.skillCode}-${index}`}
                        className={`border-b last:border-0 ${index % 2 === 0 ? "bg-muted/20" : ""}`}
                        data-testid={`row-gap-${index}`}
                      >
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
                    ))
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
              Select a position and click "Generate Gaps" to analyze tomorrow's skill coverage.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
