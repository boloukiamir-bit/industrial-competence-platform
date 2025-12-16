import { NextResponse } from "next/server";
import {
  enqueueDueEventNotifications,
  enqueueUpcomingOneToOnes,
  enqueueOverdueActions,
} from "@/services/notifications";

export async function GET() {
  const referenceDate = new Date();

  try {
    const [dueEventCount, upcomingCount, overdueCount] = await Promise.all([
      enqueueDueEventNotifications(referenceDate),
      enqueueUpcomingOneToOnes(referenceDate),
      enqueueOverdueActions(referenceDate),
    ]);

    return NextResponse.json({
      success: true,
      referenceDate: referenceDate.toISOString(),
      notifications: {
        dueEvents: dueEventCount,
        upcomingOneToOnes: upcomingCount,
        overdueActions: overdueCount,
        total: dueEventCount + upcomingCount + overdueCount,
      },
    });
  } catch (error) {
    console.error("Error running daily notifications:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
