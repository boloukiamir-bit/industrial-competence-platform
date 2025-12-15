"use client";

import { useEffect, useState } from "react";
import { RiskListSection } from "@/components/RiskListSection";
import { getAllEvents, markEventCompleted, extendDueDate } from "@/services/events";
import type { PersonEvent } from "@/types/domain";
import { Loader2 } from "lucide-react";

export default function ManagerRisksPage() {
  const [events, setEvents] = useState<PersonEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    const data = await getAllEvents();
    setEvents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleMarkCompleted = async (eventId: string) => {
    await markEventCompleted(eventId);
    fetchEvents();
  };

  const handleExtendDueDate = async (eventId: string) => {
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
      <h1 className="text-2xl font-semibold mb-6">People Risks – My Team</h1>

      {events.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">
          Inga händelser att visa. Systemet kommer automatiskt skapa händelser baserat på anställningsdata.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <RiskListSection
              title="Försenade"
              events={overdueEvents}
              onMarkCompleted={handleMarkCompleted}
              onExtendDueDate={handleExtendDueDate}
              variant="overdue"
            />
          </div>
          <div>
            <RiskListSection
              title="Förfaller snart"
              events={dueSoonEvents}
              onMarkCompleted={handleMarkCompleted}
              onExtendDueDate={handleExtendDueDate}
              variant="due_soon"
            />
          </div>
          <div>
            <RiskListSection
              title="Kommande"
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
