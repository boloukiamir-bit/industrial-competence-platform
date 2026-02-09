"use client";

import { BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { PlanVsActual } from "@/types/cockpit";

interface PlanActualWidgetProps {
  data: PlanVsActual[];
}

export function PlanActualWidget({ data }: PlanActualWidgetProps) {
  const todayPlan = data.reduce((sum, d) => sum + d.plan, 0);
  const todayActual = data.reduce((sum, d) => sum + d.actual, 0);
  const variance = todayActual - todayPlan;
  const variancePercent = ((variance / todayPlan) * 100).toFixed(1);

  return (
    <div className="cockpit-card-secondary overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="cockpit-title flex items-center gap-2">
          <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
          Plan vs Actual
        </h3>
        <div className="text-right cockpit-num">
          <p className="cockpit-body font-medium">{todayActual} / {todayPlan}</p>
          <p className={`cockpit-label ${variance >= 0 ? "cockpit-status-ok" : "cockpit-status-blocking"}`}>
            {variance >= 0 ? "+" : ""}{variancePercent}%
          </p>
        </div>
      </div>
      <div className="p-3">
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Legend 
                wrapperStyle={{ fontSize: "11px" }}
                iconType="square"
                iconSize={8}
              />
              <Bar dataKey="plan" name="Plan" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} />
              <Bar dataKey="actual" name="Actual" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
