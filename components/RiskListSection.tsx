"use client";

import { ManagerRiskCard } from "@/components/ManagerRiskCard";
import type { PersonEvent } from "@/types/domain";

interface RiskListSectionProps {
  title: string;
  events: PersonEvent[];
  onMarkCompleted: (eventId: string) => void;
  onExtendDueDate: (eventId: string) => void;
  variant?: "overdue" | "due_soon" | "upcoming";
}

const variantStyles = {
  overdue: "border-l-4 border-l-red-500",
  due_soon: "border-l-4 border-l-yellow-500",
  upcoming: "border-l-4 border-l-blue-500",
};

export function RiskListSection({
  title,
  events,
  onMarkCompleted,
  onExtendDueDate,
  variant = "upcoming",
}: RiskListSectionProps) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className={`p-4 rounded-md bg-card mb-4 ${variantStyles[variant]}`}>
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        {title}
        <span className="text-sm font-normal text-muted-foreground">
          ({events.length})
        </span>
      </h2>
      <div className="space-y-2">
        {events.map((event) => (
          <ManagerRiskCard
            key={event.id}
            event={event}
            onMarkCompleted={onMarkCompleted}
            onExtendDueDate={onExtendDueDate}
          />
        ))}
      </div>
    </div>
  );
}
