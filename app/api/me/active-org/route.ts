/**
 * POST /api/me/active-org — set profile.active_org_id for the current user.
 * Body: { org_id: string }. Governed via withMutationGovernance (tolerateInvalidJson).
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withMutationGovernance } from "@/lib/server/governance/withMutationGovernance";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withMutationGovernance(
  async (ctx) => {
    const orgId = typeof ctx.body.org_id === "string" ? ctx.body.org_id.trim() : null;
    if (!orgId) {
      return NextResponse.json({ error: "org_id required" }, { status: 400 });
    }

    const { data: membership } = await ctx.admin
      .from("memberships")
      .select("org_id")
      .eq("user_id", ctx.userId)
      .eq("org_id", orgId)
      .eq("status", "active")
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this organization" }, { status: 403 });
    }

    const { error } = await ctx.admin
      .from("profiles")
      .update({ active_org_id: orgId, active_site_id: null })
      .eq("id", ctx.userId);

    if (error) {
      console.error("[api/me/active-org]", error);
      return NextResponse.json({ error: "Failed to set active organization" }, { status: 500 });
    }

    return NextResponse.json({ active_org_id: orgId });
  },
  {
    route: "/api/me/active-org",
    action: "ME_ACTIVE_ORG_SET",
    target_type: "profile",
    allowNoShiftContext: true,
    tolerateInvalidJson: true,
    getTargetIdAndMeta: (body) => ({
      target_id: typeof body.org_id === "string" ? body.org_id.trim() : "unknown",
      meta: {},
    }),
  }
);
