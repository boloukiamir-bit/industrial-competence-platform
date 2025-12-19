"use client";

import { useEffect, useState } from "react";
import { RiskListSection } from "@/components/RiskListSection";
import { Card, CardContent } from "@/components/ui/card";
import { getAllEvents, markEventCompleted, extendDueDate } from "@/services/events";
import { isDemoMode, getDemoEvents } from "@/lib/demoRuntime";
import { COPY } from "@/lib/copy";
import type { PersonEvent } from "@/types/domain";
import { Loader2, AlertTriangle } from "lucide-react";

export default function ManagerRisksPage() {
  const [events, setEvents] = useState<PersonEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    
    if (isDemoMode()) {
      setIsDemo(true);
      setEvents(getDemoEvents() as PersonEvent[]);
      setLoading(false);
      return;
    }
    
    const data = await getAllEvents();
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleMarkCompleted = async (eventId: string) => {
    if (isDemo) {
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, status: "completed" as const, completedDate: new Date().toISOString().slice(0, 10) } : e
      ));
      return;
    }
    await markEventCompleted(eventId);
    fetchEvents();
  };

  const handleExtendDueDate = async (eventId: string) => {
    if (isDemo) {
      const addDays = (dateStr: string, days: number): string => {
        const date = new Date(dateStr);
        date.setDate(date.getDate() + days);
        return date.toISOString().slice(0, 10);
      };
      setEvents(prev => prev.map(e => 
        e.id === eventId ? { ...e, dueDate: addDays(e.dueDate, 30), status: "upcoming" as const } : e
      ));
      return;
    }
    await extendDueDate(eventId, 30);
    fetchEvents();
  };

  const overdueEvents = events.filter((e) => e.status === "overdue");
  const dueSoonEvents = events.filter((e) => e.status === "due_soon");
  const upcomingEvents = events.filter((e) => e.status === "upcoming");

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-6">People Risks - My Team</h1>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {COPY.emptyStates.risks.empty.title}
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {COPY.emptyStates.risks.empty.description}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <RiskListSection
              title={COPY.sections.overdue}
              events={overdueEvents}
              onMarkCompleted={handleMarkCompleted}
              onExtendDueDate={handleExtendDueDate}
              variant="overdue"
            />
          </div>
          <div>
            <RiskListSection
              title={COPY.sections.dueSoon}
              events={dueSoonEvents}
              onMarkCompleted={handleMarkCompleted}
              onExtendDueDate={handleExtendDueDate}
              variant="due_soon"
            />
          </div>
          <div>
            <RiskListSection
              title={COPY.sections.upcoming}
              events={upcomingEvents}
              onMarkCompleted={handleMarkCompleted}
              onExtendDueDate={handleExtendDueDate}
              variant="upcoming"
            />
          </div>
        </div>
      )}
    </div>
  );
}
