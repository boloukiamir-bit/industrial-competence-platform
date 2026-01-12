"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <BarChart2 className="h-4 w-4 text-indigo-500" />
            Plan vs Actual
          </CardTitle>
          <div className="text-right">
            <p className="text-sm font-medium">
              {todayActual} / {todayPlan}
            </p>
            <p className={`text-xs ${variance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {variance >= 0 ? "+" : ""}{variancePercent}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
