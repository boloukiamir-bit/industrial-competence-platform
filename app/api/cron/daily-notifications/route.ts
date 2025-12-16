import { NextResponse } from "next/server";
import {
  enqueueDueEventNotifications,
  enqueueUpcomingOneToOnes,
  enqueueOverdueActions,
  enqueueManagerDigestNotifications,
} from "@/services/notifications";

export async function GET() {
  const referenceDate = new Date();

  try {
    const [dueEventCount, upcomingCount, overdueCount, managerDigestCount] = await Promise.all([
      enqueueDueEventNotifications(referenceDate),
      enqueueUpcomingOneToOnes(referenceDate),
      enqueueOverdueActions(referenceDate),
      enqueueManagerDigestNotifications(referenceDate),
    ]);

    return NextResponse.json({
      success: true,
      referenceDate: referenceDate.toISOString(),
      notifications: {
        dueEvents: dueEventCount,
        upcomingOneToOnes: upcomingCount,
        overdueActions: overdueCount,
        managerDigests: managerDigestCount,
        total: dueEventCount + upcomingCount + overdueCount + managerDigestCount,
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
