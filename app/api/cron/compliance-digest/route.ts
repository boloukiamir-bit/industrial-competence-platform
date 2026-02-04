/**
 * POST /api/cron/compliance-digest — P1.9 Daily digest generation. Protected by CRON_SECRET header.
 * Runs for all orgs: one digest per org (or per site when multiple org_units). Idempotent UPSERT.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getActiveSiteName } from "@/lib/server/siteName";
import { buildDigestPayload } from "@/lib/server/complianceDigest";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CRON_HEADER = "x-cron-secret";

function errorPayload(step: string, error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return { ok: false as const, step, error: msg };
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get(CRON_HEADER) ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected || secret !== expected) {
    return NextResponse.json(errorPayload("unauthorized", "Invalid or missing CRON_SECRET"), {
      status: 401,
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const digestDateStr = today.toISOString().slice(0, 10);
  const expiringDays = 30;

  let digestsCreated = 0;
  let digestsSkipped = 0;

  try {
    const { data: orgs, error: orgsErr } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .order("id");
    if (orgsErr) {
      console.error("cron/compliance-digest organizations", orgsErr);
      return NextResponse.json(errorPayload("organizations", orgsErr.message), { status: 500 });
    }
    const orgList = orgs ?? [];

    for (const org of orgList) {
      const orgId = org.id as string;
      const { data: units, error: unitsErr } = await supabaseAdmin
        .from("org_units")
        .select("id, name")
        .eq("org_id", orgId)
        .order("name");
      if (unitsErr) {
        console.error("cron/compliance-digest org_units", { orgId, error: unitsErr });
        continue;
      }
      const unitList = units ?? [];

      const targets: { siteId: string | null; siteName: string | null }[] = [];
      if (unitList.length === 1) {
        targets.push({
          siteId: unitList[0].id as string,
          siteName: (unitList[0].name as string) ?? null,
        });
      } else if (unitList.length > 1) {
        targets.push({ siteId: null, siteName: null });
        for (const u of unitList) {
          const name = await getActiveSiteName(supabaseAdmin, u.id as string, orgId);
          targets.push({ siteId: u.id as string, siteName: name ?? (u.name as string) ?? null });
        }
      } else {
        targets.push({ siteId: null, siteName: null });
      }

      for (const { siteId, siteName } of targets) {
        try {
          const payload = await buildDigestPayload(
            supabaseAdmin,
            orgId,
            siteId,
            new Date(today),
            expiringDays,
            siteName
          );

          let q = supabaseAdmin
            .from("compliance_daily_digests")
            .select("id")
            .eq("org_id", orgId)
            .eq("digest_date", digestDateStr);
          q = siteId ? q.eq("site_id", siteId) : q.is("site_id", null);
          const { data: existingRows } = await q.limit(1);
          const row = existingRows?.[0] ?? null;

          if (row?.id) {
            const { error: upErr } = await supabaseAdmin
              .from("compliance_daily_digests")
              .update({ payload })
              .eq("id", row.id);
            if (upErr) {
              console.error("cron/compliance-digest update", { orgId, siteId, error: upErr });
              digestsSkipped++;
            } else {
              digestsSkipped++;
            }
          } else {
            const { error: inErr } = await supabaseAdmin.from("compliance_daily_digests").insert({
              org_id: orgId,
              site_id: siteId,
              digest_date: digestDateStr,
              payload,
            });
            if (inErr) {
              if (inErr.code === "23505") {
                digestsSkipped++;
              } else {
                console.error("cron/compliance-digest insert", { orgId, siteId, error: inErr });
                digestsSkipped++;
              }
            } else {
              digestsCreated++;
            }
          }
        } catch (err) {
          console.error("cron/compliance-digest buildDigestPayload", { orgId, siteId, error: err });
          digestsSkipped++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      digestsCreated,
      digestsSkipped,
    });
  } catch (err) {
    console.error("POST /api/cron/compliance-digest failed:", err);
    return NextResponse.json(errorPayload("unexpected", err), { status: 500 });
  }
}
