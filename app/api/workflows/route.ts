import { NextRequest, NextResponse } from "next/server";
import { getOrgIdFromSession } from "@/lib/orgSession";

export async function GET(request: NextRequest) {
  const session = await getOrgIdFromSession(request);
  if (!session.success) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  return NextResponse.json({
    deprecation: "This endpoint is deprecated. Use /api/workflows/instances instead.",
    redirect: "/api/workflows/instances"
  }, { status: 410 });
}

export async function POST(request: NextRequest) {
  const session = await getOrgIdFromSession(request);
  if (!session.success) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  return NextResponse.json({
    deprecation: "This endpoint is deprecated. Use /api/workflows/instances instead.",
    redirect: "/api/workflows/instances"
  }, { status: 410 });
}
