"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle, Clock } from "lucide-react";
import type { PersonEvent } from "@/types/domain";

interface ManagerRiskCardProps {
  event: PersonEvent;
  onMarkCompleted: (eventId: string) => void;
  onExtendDueDate: (eventId: string) => void;
}

const categoryLabels: Record<string, string> = {
  contract: "Kontrakt",
  medical_check: "Hälsokontroll",
  training: "Utbildning",
  onboarding: "Onboarding",
  offboarding: "Offboarding",
  work_env_delegation: "Arbetsmiljö",
  equipment: "Utrustning",
};

const statusColors: Record<string, string> = {
  overdue: "destructive",
  due_soon: "secondary",
  upcoming: "outline",
  completed: "default",
};

export function ManagerRiskCard({
  event,
  onMarkCompleted,
  onExtendDueDate,
}: ManagerRiskCardProps) {
  const formattedDate = new Date(event.dueDate).toLocaleDateString("sv-SE");

  return (
    <Card className="mb-3" data-testid={`card-event-${event.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-medium">{event.title}</CardTitle>
          <Badge variant={statusColors[event.status] as any} className="text-xs">
            {categoryLabels[event.category] || event.category}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-sm text-muted-foreground mb-2">
          {event.employeeName}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Calendar className="h-3 w-3" />
          <span>Förfaller: {formattedDate}</span>
        </div>
        {event.notes && (
          <p className="text-xs text-muted-foreground mb-3">{event.notes}</p>
        )}
        {event.status !== "completed" && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              variant="default"
              onClick={() => onMarkCompleted(event.id)}
              data-testid={`button-complete-${event.id}`}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Markera klar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onExtendDueDate(event.id)}
              data-testid={`button-extend-${event.id}`}
            >
              <Clock className="h-3 w-3 mr-1" />
              +30 dagar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
