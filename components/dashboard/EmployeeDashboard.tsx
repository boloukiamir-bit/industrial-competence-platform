"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Calendar, ClipboardList, FileText, Award } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { CurrentUser } from "@/lib/auth";

type EmployeeDashboardData = {
  upcomingTrainings: number;
  nextMeeting: { id: string; scheduledAt: string; managerName: string } | null;
  openTasks: number;
  recentDocuments: { id: string; title: string; type: string }[];
  topSkills: { skillName: string; level: number }[];
};

export function EmployeeDashboard({ user }: { user: CurrentUser }) {
  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      if (!user.employeeId) {
        setLoading(false);
        return;
      }

      const today = new Date().toISOString().split("T")[0];

      const [trainingsRes, meetingRes, tasksRes, docsRes, skillsRes] = await Promise.all([
        supabase.from("person_events")
          .select("id", { count: "exact" })
          .eq("employee_id", user.employeeId)
          .in("category", ["training", "certificate"])
          .neq("status", "completed")
          .gte("due_date", today),
        supabase.from("one_to_one_meetings")
          .select("id, scheduled_at, manager:manager_id(name)")
          .eq("employee_id", user.employeeId)
          .in("status", ["planned", "in_progress"])
          .gte("scheduled_at", today)
          .order("scheduled_at")
          .limit(1),
        supabase.from("person_events")
          .select("id", { count: "exact" })
          .eq("employee_id", user.employeeId)
          .neq("status", "completed"),
        supabase.from("documents")
          .select("id, title, type")
          .eq("employee_id", user.employeeId)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase.from("employee_skills")
          .select("level, skills(name)")
          .eq("employee_id", user.employeeId)
          .order("level", { ascending: false })
          .limit(5),
      ]);

      const meetingData = meetingRes.data?.[0];
      let nextMeeting = null;
      if (meetingData) {
        const mgrData = meetingData.manager as unknown as { name?: string } | null;
        nextMeeting = {
          id: meetingData.id,
          scheduledAt: meetingData.scheduled_at,
          managerName: mgrData?.name || "Unknown",
        };
      }

      const topSkills = (skillsRes.data || []).map((s) => {
        const skillInfo = s.skills as unknown as { name: string } | null;
        return {
          skillName: skillInfo?.name || "Unknown",
          level: s.level as number,
        };
      });

      setData({
        upcomingTrainings: trainingsRes.count || 0,
        nextMeeting,
        openTasks: tasksRes.count || 0,
        recentDocuments: docsRes.data || [],
        topSkills,
      });
      setLoading(false);
    }
    loadDashboard();
  }, [user.employeeId]);

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
          <p className="text-gray-500 dark:text-gray-400">No employee data available. Please ensure your account is linked to an employee profile.</p>
        </CardContent>
      </Card>
    );
  }

  const levelLabels = ["None", "Basic", "Intermediate", "Advanced", "Expert"];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-trainings">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upcoming Trainings</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">{data.upcomingTrainings}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-next-meeting">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Next 1:1</p>
                {data.nextMeeting ? (
                  <>
                    <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                      {new Date(data.nextMeeting.scheduledAt).toLocaleDateString("sv-SE")}
                    </p>
                    <p className="text-xs text-gray-400">with {data.nextMeeting.managerName}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">None scheduled</p>
                )}
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-tasks">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-base">My Documents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.recentDocuments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No documents available</p>
            ) : (
              <div className="space-y-3">
                {data.recentDocuments.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-900 dark:text-white truncate">{doc.title}</span>
                    <Badge variant="secondary">{doc.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-gray-400" />
              <CardTitle className="text-base">My Competencies</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {data.topSkills.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No competencies recorded</p>
            ) : (
              <div className="space-y-3">
                {data.topSkills.map((skill, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-gray-900 dark:text-white">{skill.skillName}</span>
                    <Badge variant="default">{levelLabels[skill.level] || `Level ${skill.level}`}</Badge>
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
