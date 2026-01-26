import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db/pool";
export const runtime = "nodejs";

const SETUP_SECRET = process.env.SPALJISTEN_SETUP_SECRET || "sp-go-live-2024";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("x-setup-secret");
    const body = await request.json();
    const { email, secret } = body;
    
    const providedSecret = authHeader || secret;
    if (providedSecret !== SETUP_SECRET) {
      return NextResponse.json({ error: "Unauthorized: Invalid setup secret" }, { status: 401 });
    }
    
    if (!email || email.toLowerCase() !== "daniel.buhre@spaljisten.se") {
      return NextResponse.json({ error: "Invalid setup request: Only daniel.buhre@spaljisten.se can be set up" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query("SELECT sp_setup_daniel_admin() as result");
      const setupResult = result.rows[0]?.result;
      
      if (!setupResult?.success) {
        return NextResponse.json({ error: setupResult?.error || "Setup failed" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: "Daniel Buhre has been set up as Customer Admin + Data Owner for Spaljisten",
        details: setupResult,
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Spaljisten Go-Live Setup API",
    instructions: [
      "1. Daniel signs up at /login with email: daniel.buhre@spaljisten.se",
      "2. POST to this endpoint with { email: 'daniel.buhre@spaljisten.se', secret: '<setup-secret>' }",
      "3. Or run SQL directly: SELECT sp_setup_daniel_admin();",
      "4. Daniel can then access /app/spaljisten/import and /app/spaljisten/dashboard",
    ],
    note: "This endpoint requires a setup secret for security",
  });
}
