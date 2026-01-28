"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, ClipboardList, Calendar, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { CurrentUser } from "@/lib/auth";
import { useOrg } from "@/hooks/useOrg";

type ManagerDashboardData = {
  teamHeadcount: number;
  openTasks: number;
  upcomingMeetings: number;
  criticalItems: { id: string; title: string; employeeName: string; dueDate: string; isOverdue: boolean }[];
  meetings: { id: string; employeeName: string; scheduledAt: string; status: string }[];
};

export function ManagerDashboard({ user }: { user: CurrentUser }) {
  const { currentOrg } = useOrg();
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user.employeeId || !currentOrg) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];
      const fourteenDaysLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      if (process.env.NODE_ENV !== "production") {
        const requestId = crypto?.randomUUID?.() ?? String(Date.now());
        console.log("[DEV ManagerDashboard]", { requestId, orgId: currentOrg.id, table: "employees" });
      }
      const [teamRes, eventsRes, meetingsRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, name", { count: "exact" })
          .eq("org_id", currentOrg.id)
          .eq("manager_id", user.employeeId)
          .eq("is_active", true),
        supabase.from("person_events")
          .select("id, title, due_date, employees:employee_id(name)")
          .eq("owner_manager_id", user.employeeId)
          .neq("status", "completed")
          .order("due_date"),
        supabase.from("one_to_one_meetings")
          .select("id, scheduled_at, status, employees:employee_id(name)")
          .eq("manager_id", user.employeeId)
          .in("status", ["planned", "in_progress"])
          .gte("scheduled_at", today)
          .lte("scheduled_at", fourteenDaysLater)
          .order("scheduled_at"),
      ]);

      const events = eventsRes.data || [];
      const criticalItems = events
        .filter((e) => e.due_date)
        .map((e) => {
          const empData = e.employees as unknown as { name?: string } | null;
          return {
            id: e.id,
            title: e.title,
            employeeName: empData?.name || "Unknown",
            dueDate: e.due_date,
            isOverdue: e.due_date < today,
          };
        })
        .slice(0, 5);

      const meetings = (meetingsRes.data || []).map((m) => {
        const empData = m.employees as unknown as { name?: string } | null;
        return {
          id: m.id,
          employeeName: empData?.name || "Unknown",
          scheduledAt: m.scheduled_at,
          status: m.status,
        };
      }).slice(0, 5);

      setData({
        teamHeadcount: teamRes.count || 0,
        openTasks: events.length,
        upcomingMeetings: meetingsRes.data?.length || 0,
        criticalItems,
        meetings,
      });
      setLoading(false);
    }
    loadDashboard();
  }, [user.employeeId, currentOrg]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
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

  if (!data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-gray-500 dark:text-gray-400">No manager data available. Please ensure your account is linked to an employee profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-team-headcount">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">My Team</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{data.teamHeadcount}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-open-tasks">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Open Tasks</p>
                <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mt-1">{data.openTasks}</p>
              </div>
              <ClipboardList className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-upcoming-meetings">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming 1:1s</p>
                <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mt-1">{data.upcomingMeetings}</p>
                <p className="text-xs text-gray-400 mt-1">Next 14 days</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">Critical Items</CardTitle>
              <Link href="/app/manager/risks">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {data.criticalItems.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No critical items</p>
            ) : (
              <div className="space-y-3">
                {data.criticalItems.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.employeeName}</p>
                    </div>
                    <Badge variant={item.isOverdue ? "destructive" : "default"}>
                      {item.isOverdue ? "Overdue" : item.dueDate}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">My 1:1 Meetings</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.meetings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No upcoming meetings</p>
            ) : (
              <div className="space-y-3">
                {data.meetings.map((meeting) => (
                  <Link key={meeting.id} href={`/app/one-to-ones/${meeting.id}`}>
                    <div className="flex items-center justify-between gap-4 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{meeting.employeeName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(meeting.scheduledAt).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant="secondary">{meeting.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
