"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { 
  Users, 
  AlertTriangle, 
  FileCheck, 
  Workflow,
  ArrowRight,
  Plus,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { SetupProgressCard } from "@/components/SetupProgressCard";
import { isDemoMode, getDemoMetrics } from "@/lib/demoRuntime";

type DashboardData = {
  totalHeadcount: number;
  overdueEvents: number;
  dueSoonEvents: number;
  expiringContracts: number;
  openWorkflows: number;
  riskUnits: { unitName: string; riskIndex: number; criticalCount: number }[];
  avgReadiness?: number;
  topGapSkill?: string;
};

export function HrDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      const isProd = process.env.NODE_ENV === 'production';
      
      // Demo mode only allowed in non-production when no authenticated org exists
      if (!isProd && isDemoMode()) {
        const demoMetrics = getDemoMetrics();
        setData({
          totalHeadcount: demoMetrics.totalEmployees,
          overdueEvents: 3,
          dueSoonEvents: 5,
          expiringContracts: 2,
          openWorkflows: 4,
          avgReadiness: demoMetrics.avgReadiness,
          topGapSkill: demoMetrics.topGapSkill,
          riskUnits: [],
        });
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const ninetyDaysLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [headcountRes, eventsRes, contractsRes, workflowsRes] = await Promise.all([
        supabase.from("employees").select("id, line", { count: "exact" }).eq("is_active", true),
        supabase.from("person_events").select("id, due_date, category, employees:employee_id(line)").neq("status", "completed"),
        supabase.from("employees")
          .select("id")
          .eq("is_active", true)
          .eq("employment_type", "temporary")
          .not("contract_end_date", "is", null)
          .lte("contract_end_date", ninetyDaysLater),
        supabase.from("hr_workflow_instances").select("id", { count: "exact" }).eq("status", "active"),
      ]);

      const events = eventsRes.data || [];
      let overdueCount = 0;
      let dueSoonCount = 0;
      const unitRisks: Record<string, { total: number; critical: number }> = {};

      for (const event of events) {
        if (!event.due_date) continue;
        const isOverdue = event.due_date < today;
        const isDueSoon = event.due_date >= today && event.due_date <= thirtyDaysLater;
        
        if (isOverdue) overdueCount++;
        if (isDueSoon) dueSoonCount++;

        const empData = event.employees as unknown as { line?: string } | null;
        const unitName = empData?.line || "Unassigned";

        if (!unitRisks[unitName]) {
          unitRisks[unitName] = { total: 0, critical: 0 };
        }
        unitRisks[unitName].total++;
        if (isOverdue || isDueSoon) {
          unitRisks[unitName].critical++;
        }
      }

      const employees = headcountRes.data || [];
      const unitHeadcounts: Record<string, number> = {};
      for (const emp of employees) {
        const unit = emp.line || "Unassigned";
        unitHeadcounts[unit] = (unitHeadcounts[unit] || 0) + 1;
      }

      const riskUnits = Object.entries(unitRisks)
        .map(([unitName, r]) => ({
          unitName,
          riskIndex: unitHeadcounts[unitName] ? r.critical / unitHeadcounts[unitName] : 0,
          criticalCount: r.critical,
        }))
        .sort((a, b) => b.riskIndex - a.riskIndex)
        .slice(0, 5);

      setData({
        totalHeadcount: headcountRes.count || 0,
        overdueEvents: overdueCount,
        dueSoonEvents: dueSoonCount,
        expiringContracts: contractsRes.data?.length || 0,
        openWorkflows: workflowsRes.count || 0,
        riskUnits,
      });
      setLoading(false);
    }
    loadDashboard();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24" />
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <SetupProgressCard className="mb-2" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-headcount">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Headcount</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data.totalHeadcount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compliance Risk</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-bold text-red-600 dark:text-red-400">{data.overdueEvents}</span>
                  <span className="text-sm text-gray-400">+{data.dueSoonEvents} soon</span>
                </div>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-contracts">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Contracts Ending</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{data.expiringContracts}</p>
                <p className="text-xs text-gray-400 mt-1">Next 90 days</p>
              </div>
              <FileCheck className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-workflows">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open Workflows</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{data.openWorkflows}</p>
              </div>
              <Workflow className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/app/hr/workflows?action=start&template=sick_leave">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Sick Leave Follow-up
                </Button>
              </Link>
              <Link href="/app/hr/workflows?action=start&template=rehab">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Rehab Process
                </Button>
              </Link>
              <Link href="/app/hr/workflows?action=start&template=parental_leave">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Parental Leave
                </Button>
              </Link>
              <Link href="/app/hr/workflows?action=start&template=reboarding">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Plus className="h-4 w-4" />
                  Reboarding
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Top Risk Units</CardTitle>
              <Link href="/app/hr/analytics">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.riskUnits.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No analytics data yet for this organization
              </p>
            ) : (
              <div className="space-y-3">
                {data.riskUnits.map((unit) => (
                  <div key={unit.unitName} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{unit.unitName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">{unit.criticalCount} events</span>
                      <Badge 
                        variant={unit.riskIndex >= 0.5 ? "destructive" : unit.riskIndex >= 0.2 ? "default" : "secondary"}
                      >
                        {(unit.riskIndex * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
