import { NextRequest, NextResponse } from "next/server";
import { exportEmployeeData } from "@/services/gdpr";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employee_id");

  if (!employeeId) {
    return NextResponse.json({ error: "employee_id is required" }, { status: 400 });
  }

  try {
    const data = await exportEmployeeData(employeeId);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error exporting employee data:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
