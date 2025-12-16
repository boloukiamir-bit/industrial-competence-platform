"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, Calendar, TrendingUp, Activity, BarChart3, Clock, Shield } from "lucide-react";
import { getHRAnalytics } from "@/services/analytics";
import { getCurrentUser } from "@/lib/auth";
import type { HRAnalytics } from "@/types/domain";

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  testId,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1" data-testid={testId}>
              {value}
            </p>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getRiskColor(riskIndex: number): "destructive" | "default" | "secondary" {
  if (riskIndex >= 0.5) return "destructive";
  if (riskIndex >= 0.2) return "default";
  return "secondary";
}

export default function HRAnalyticsPage() {
  const [analytics, setAnalytics] = useState<HRAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser();
      if (!user || user.role !== "HR_ADMIN") {
        setAuthorized(true);
      }

      const data = await getHRAnalytics();
      setAnalytics(data);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              This page is only accessible to HR Administrators.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Unable to load analytics</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          HR Analytics Dashboard
        </h1>
        <p className="text-muted-foreground">Key workforce metrics and insights</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Headcount"
          value={analytics.totalHeadcount}
          icon={Users}
          description="Active employees"
          testId="metric-headcount"
        />
        <MetricCard
          title="Sick Leave Rate"
          value={analytics.absencesAvailable ? `${analytics.sickLeaveRatio}%` : "N/A"}
          icon={Activity}
          description={analytics.absencesAvailable ? "Last 30 days" : "Data not available"}
          testId="metric-sick-leave"
        />
        <MetricCard
          title="Contracts Ending"
          value={analytics.temporaryContractsEndingSoon}
          icon={Calendar}
          description="Within 90 days"
          testId="metric-contracts-ending"
        />
        <MetricCard
          title="Critical Events"
          value={analytics.criticalEventsByStatus.overdue + analytics.criticalEventsByStatus.dueSoon}
          icon={AlertTriangle}
          description={`${analytics.criticalEventsByStatus.overdue} overdue, ${analytics.criticalEventsByStatus.dueSoon} due soon`}
          testId="metric-critical-events"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Headcount by Unit & Employment Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.headcountByOrgUnit.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Unit</th>
                      <th className="text-center py-2">Perm</th>
                      <th className="text-center py-2">Temp</th>
                      <th className="text-center py-2">Cons</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.headcountByOrgUnit.map((item) => (
                      <tr key={item.orgUnitName} className="border-b last:border-0">
                        <td className="py-2">{item.orgUnitName}</td>
                        <td className="text-center py-2">{item.permanent}</td>
                        <td className="text-center py-2">{item.temporary}</td>
                        <td className="text-center py-2">{item.consultant}</td>
                        <td className="text-right py-2 font-medium">{item.count}</td>
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
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Temporary Contracts Ending (90 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.temporaryContractsEndingList.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No contracts ending soon</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {analytics.temporaryContractsEndingList.map((emp) => (
                  <div key={emp.id} className="flex items-center justify-between gap-4 py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{emp.name}</p>
                      <p className="text-sm text-muted-foreground">{emp.role}</p>
                    </div>
                    <Badge variant="outline">
                      {new Date(emp.contractEndDate).toLocaleDateString("sv-SE")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Critical Events by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.criticalEventsCount.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No critical events</p>
            ) : (
              <div className="space-y-3">
                {analytics.criticalEventsCount.map((item) => (
                  <div key={item.category} className="flex items-center justify-between gap-4">
                    <span className="text-sm capitalize">{item.category.replace(/_/g, " ")}</span>
                    <Badge
                      variant={item.count > 5 ? "destructive" : item.count > 2 ? "default" : "secondary"}
                    >
                      {item.count}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              People Risk Index by Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.riskIndexByUnit.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            ) : (
              <div className="space-y-3">
                {analytics.riskIndexByUnit.slice(0, 8).map((item) => (
                  <div key={item.unitName} className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.unitName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.overdueCount} overdue, {item.dueSoonCount} due soon / {item.headcount} staff
                      </p>
                    </div>
                    <Badge variant={getRiskColor(item.riskIndex)}>
                      {item.riskIndex.toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Employment Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.headcountByEmploymentType.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No data available</p>
            ) : (
              <div className="space-y-3">
                {analytics.headcountByEmploymentType.map((item) => (
                  <div key={item.type} className="flex items-center justify-between gap-4">
                    <span className="text-sm capitalize">{item.type}</span>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={(item.count / analytics.totalHeadcount) * 100}
                        className="w-24 h-2"
                      />
                      <span className="text-sm font-medium w-8 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Skill Level Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.skillDistribution.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No skills data</p>
            ) : (
              <div className="space-y-4">
                {analytics.skillDistribution.slice(0, 5).map((skill) => (
                  <div key={skill.skillName}>
                    <p className="text-sm font-medium mb-1">{skill.skillName}</p>
                    <div className="flex items-center gap-1">
                      {skill.levels.map((count, level) => (
                        <div
                          key={level}
                          className="flex-1 bg-muted rounded text-center text-xs py-1"
                          title={`Level ${level}: ${count} employees`}
                        >
                          {count > 0 ? count : "-"}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      {[0, 1, 2, 3, 4].map((l) => (
                        <div key={l} className="flex-1 text-center">
                          L{l}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {!analytics.absencesAvailable && (
        <Card>
          <CardContent className="py-8 text-center">
            <Activity className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              Sick leave analytics coming soon - awaiting absences data integration.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
