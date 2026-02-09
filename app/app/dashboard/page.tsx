"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { HrDashboard } from "@/components/dashboard/HrDashboard";
import { ManagerDashboard } from "@/components/dashboard/ManagerDashboard";
import { EmployeeDashboard } from "@/components/dashboard/EmployeeDashboard";
import { useOrg } from "@/hooks/useOrg";
import { isHrAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { currentRole } = useOrg();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getRoleLabel = () => {
    switch (user?.role) {
      case "HR_ADMIN":
        return "HR Administrator";
      case "MANAGER":
        return "Manager";
      case "EMPLOYEE":
        return "Employee";
      default:
        return "";
    }
  };

  return (
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getGreeting()}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {getRoleLabel()} Dashboard
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/onboarding">Get started</Link>
        </Button>
      </div>

      {isHrAdmin(currentRole) && <HrDashboard />}
      {user?.role === "MANAGER" && <ManagerDashboard user={user} />}
      {user?.role === "EMPLOYEE" && <EmployeeDashboard user={user} />}
      {!user?.role && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          Unable to determine user role. Please contact support.
        </div>
      )}
    </div>
  );
}
