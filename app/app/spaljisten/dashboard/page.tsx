"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users,
  Building2,
  Wrench,
  TrendingUp,
  AlertTriangle,
  Download,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type SPArea = { id: string; areaCode: string; areaName: string };
type SPStation = { id: string; stationCode: string; stationName: string; areaId: string | null };

type DashboardKPIs = {
  totalEmployees: number;
  totalStations: number;
  totalSkills: number;
  averageIndependentRate: number;
};

type TopRiskStation = {
  stationCode: string;
  stationName: string;
  independentCount: number;
  totalSkills: number;
  riskScore: number;
};

type SkillGapData = {
  stationCode: string;
  stationName: string;
  skillId: string;
  skillName: string;
  independentCount: number;
  totalEmployees: number;
  employees: { employeeId: string; employeeName: string; rating: number | null }[];
  riskLevel: "ok" | "warning" | "critical";
};

type DashboardData = {
  kpis: DashboardKPIs;
  topRiskStations: TopRiskStation[];
  skillGapData: SkillGapData[];
  filterOptions: { areas: SPArea[]; stations: SPStation[] };
};

export default function SpaljistenDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedArea, setSelectedArea] = useState<string>("");
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedArea) params.set("areaId", selectedArea);
      if (selectedStation) params.set("stationId", selectedStation);

      const response = await fetch(`/api/spaljisten/dashboard?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to load dashboard");
      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedArea, selectedStation]);

  const handleExport = () => {
    const params = new URLSearchParams();
    if (selectedArea) params.set("areaId", selectedArea);
    if (selectedStation) params.set("stationId", selectedStation);
    window.open(`/api/spaljisten/export?${params.toString()}`, "_blank");
  };

  const toggleSkillExpand = (skillId: string) => {
    const newExpanded = new Set(expandedSkills);
    if (newExpanded.has(skillId)) {
      newExpanded.delete(skillId);
    } else {
      newExpanded.add(skillId);
    }
    setExpandedSkills(newExpanded);
  };

  const getRiskBadge = (level: "ok" | "warning" | "critical") => {
    switch (level) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "warning":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Warning</Badge>;
      default:
        return <Badge className="bg-green-500 hover:bg-green-600">OK</Badge>;
    }
  };

  const filteredStations = data?.filterOptions.stations.filter(
    (s) => !selectedArea || s.areaId === selectedArea
  ) || [];

  if (loading && !data) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
            <Button onClick={fetchData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3 mb-4" data-testid="banner-data-status">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="font-medium text-blue-900 dark:text-blue-100">Spaljisten</span>
          <span className="text-blue-700 dark:text-blue-300">
            Areas: {data.filterOptions.areas.length}
          </span>
          <span className="text-blue-700 dark:text-blue-300">
            Employees: {data.kpis.totalEmployees}
          </span>
          <span className="text-blue-700 dark:text-blue-300">
            Skills: {data.skillGapTable.length}
          </span>
          <span className="text-blue-700 dark:text-blue-300">
            Ratings: {data.kpis.totalRatings || 0}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-dashboard">
            Skill Matrix Dashboard
          </h1>
          <p className="text-muted-foreground">
            Gap and risk analysis for Spaljisten
          </p>
        </div>
        <Button onClick={handleExport} data-testid="button-export">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={selectedArea || "all"} onValueChange={(v) => { setSelectedArea(v === "all" ? "" : v); setSelectedStation(""); }}>
          <SelectTrigger className="w-[200px]" data-testid="select-area">
            <SelectValue placeholder="All Areas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {data.filterOptions.areas.map((area) => (
              <SelectItem key={area.id} value={area.id}>
                {area.areaName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedStation || "all"} onValueChange={(v) => setSelectedStation(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[200px]" data-testid="select-station">
            <SelectValue placeholder="All Stations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stations</SelectItem>
            {filteredStations.map((station) => (
              <SelectItem key={station.id} value={station.id}>
                {station.stationName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="kpi-employees">
                  {data.kpis.totalEmployees}
                </p>
                <p className="text-sm text-muted-foreground">Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-purple-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="kpi-stations">
                  {data.kpis.totalStations}
                </p>
                <p className="text-sm text-muted-foreground">Stations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="kpi-skills">
                  {data.kpis.totalSkills}
                </p>
                <p className="text-sm text-muted-foreground">Skills</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold" data-testid="kpi-rate">
                  {data.kpis.averageIndependentRate}%
                </p>
                <p className="text-sm text-muted-foreground">Independent Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Top 10 Risk Stations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.topRiskStations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No risk data available. Import skill ratings first.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Station</th>
                    <th className="text-center p-2">Independent Count</th>
                    <th className="text-center p-2">Total Skills</th>
                    <th className="text-center p-2">Risk Score</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topRiskStations.map((station, idx) => (
                    <tr key={station.stationCode} className="border-b hover-elevate">
                      <td className="p-2">
                        <span className="font-medium">{idx + 1}. </span>
                        {station.stationName}
                        <span className="text-muted-foreground ml-1">({station.stationCode})</span>
                      </td>
                      <td className="text-center p-2">{station.independentCount}</td>
                      <td className="text-center p-2">{station.totalSkills}</td>
                      <td className="text-center p-2">
                        <Badge variant={station.riskScore > 5 ? "destructive" : "default"}>
                          {station.riskScore}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skill Gap Details</CardTitle>
        </CardHeader>
        <CardContent>
          {data.skillGapData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No skill data available for the selected filters.
            </p>
          ) : (
            <div className="space-y-2">
              {data.skillGapData.map((item) => (
                <div
                  key={`${item.stationCode}-${item.skillId}`}
                  className="border rounded-md overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-3 hover-elevate text-left"
                    onClick={() => toggleSkillExpand(`${item.stationCode}-${item.skillId}`)}
                    data-testid={`button-expand-${item.skillId}`}
                  >
                    <div className="flex items-center gap-3">
                      {expandedSkills.has(`${item.stationCode}-${item.skillId}`) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <div>
                        <span className="font-medium">{item.skillName}</span>
                        <span className="text-muted-foreground ml-2">
                          ({item.stationName})
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        {item.independentCount} / {item.totalEmployees} independent
                      </span>
                      {getRiskBadge(item.riskLevel)}
                    </div>
                  </button>

                  {expandedSkills.has(`${item.stationCode}-${item.skillId}`) && (
                    <div className="border-t bg-muted/50 p-3">
                      {item.employees.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No employees rated for this skill.</p>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {item.employees.map((emp) => (
                            <div
                              key={emp.employeeId}
                              className="flex items-center justify-between p-2 bg-background rounded border"
                            >
                              <span className="text-sm truncate">{emp.employeeName}</span>
                              <Badge
                                variant={
                                  emp.rating === null
                                    ? "outline"
                                    : emp.rating >= 3
                                    ? "default"
                                    : "secondary"
                                }
                                className={
                                  emp.rating !== null && emp.rating >= 3
                                    ? "bg-green-500"
                                    : emp.rating !== null && emp.rating < 3
                                    ? "bg-yellow-500"
                                    : ""
                                }
                              >
                                {emp.rating ?? "N"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
