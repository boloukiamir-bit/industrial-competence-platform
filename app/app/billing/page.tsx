"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard } from "lucide-react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { pricingConfig, calculateYearlyCost, type PlanId } from "@/lib/pricing";
import { supabase } from "@/lib/supabaseClient";

export default function BillingPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [headcount, setHeadcount] = useState(0);
  const [loading, setLoading] = useState(true);

  const currentPlan: PlanId = "enterprise";

  useEffect(() => {
    async function loadData() {
      const [userData, headcountRes] = await Promise.all([
        getCurrentUser(),
        supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      setUser(userData);
      setHeadcount(headcountRes.count || 0);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (user?.role !== "HR_ADMIN") {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Access Denied</h2>
              <p className="text-gray-500 dark:text-gray-400">Only HR administrators can access billing settings.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = pricingConfig[currentPlan];
  const yearlyCost = calculateYearlyCost(currentPlan, headcount);
  const monthlyCost = Math.round(yearlyCost / 12);
  const perEmployeeCost = headcount > 0 ? Math.round(yearlyCost / headcount / 12) : 0;

  return (
    <div className="p-8 max-w-4xl" data-testid="billing-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your subscription and billing details</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-gray-400" />
                <CardTitle>Current Plan</CardTitle>
              </div>
              <Badge variant="default" data-testid="badge-current-plan">
                {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Active Employees</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-headcount">{headcount}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Estimated Yearly Cost</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-yearly-cost">{yearlyCost.toLocaleString()} SEK</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Per Employee / Month</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-per-employee">{perEmployeeCost} SEK</p>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">Included Features</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Check className="h-4 w-4 text-green-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Billing is currently handled manually. For invoices, payment questions, or plan changes, 
                please contact your account representative or email billing@industrialcompetence.app.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">Billing Cycle</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Annual</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">Base Fee</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{plan.baseYearlySEK.toLocaleString()} SEK / year</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                <span className="text-sm text-gray-600 dark:text-gray-300">Per Employee (after {plan.maxIncludedEmployees})</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">{plan.perEmployeeMonthlySEK} SEK / month</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Estimated Monthly Total</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{monthlyCost.toLocaleString()} SEK</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
