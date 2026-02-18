import { cookies, headers } from "next/headers";
import type { CockpitComplianceSummaryResponse } from "@/app/api/cockpit/compliance-summary/route";
import type { CockpitSummaryResponse } from "@/app/api/cockpit/summary/route";
import { PageFrame } from "@/components/layout/PageFrame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatDateYMD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function readJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type ActiveOrganizationContext = {
  ok: true;
  org_id: string | null;
  org_name: string | null;
  site_id: string | null;
  site_name: string | null;
  logo_url: string | null;
};

export default async function ExecutiveOverviewPage() {
  const today = new Date();
  const todayYMD = formatDateYMD(today);
  const displayDate = formatDisplayDate(today);

  const headerStore = await headers();
  const host = headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${protocol}://${host}` : "http://localhost:3000";
  const cookieHeader = (await cookies()).toString();
  const requestHeaders = cookieHeader ? { cookie: cookieHeader } : undefined;

  const summaryUrl = new URL("/api/cockpit/summary", baseUrl);
  summaryUrl.searchParams.set("date", todayYMD);
  summaryUrl.searchParams.set("shift_code", "Day");
  summaryUrl.searchParams.set("line", "all");

  const complianceUrl = new URL("/api/cockpit/compliance-summary", baseUrl);
  complianceUrl.searchParams.set("date", todayYMD);
  complianceUrl.searchParams.set("shift_code", "Day");
  complianceUrl.searchParams.set("line", "all");

  const contextUrl = new URL("/api/context/active-organization", baseUrl);

  const [summaryRes, complianceRes, contextRes] = await Promise.all([
    fetch(summaryUrl.toString(), { headers: requestHeaders, cache: "no-store" }),
    fetch(complianceUrl.toString(), { headers: requestHeaders, cache: "no-store" }),
    fetch(contextUrl.toString(), { headers: requestHeaders, cache: "no-store" }),
  ]);

  const summaryPayload = summaryRes.ok
    ? await readJson<CockpitSummaryResponse | { error?: string }>(summaryRes)
    : null;
  const compliancePayload = complianceRes.ok
    ? await readJson<CockpitComplianceSummaryResponse | { ok?: boolean }>(complianceRes)
    : null;
  const contextPayload = contextRes.ok
    ? await readJson<ActiveOrganizationContext | { error?: string }>(contextRes)
    : null;

  const summary =
    summaryPayload && typeof (summaryPayload as CockpitSummaryResponse).active_total === "number"
      ? (summaryPayload as CockpitSummaryResponse)
      : null;
  const complianceSummary =
    compliancePayload && (compliancePayload as CockpitComplianceSummaryResponse).ok
      ? (compliancePayload as CockpitComplianceSummaryResponse)
      : null;
  const context =
    contextPayload && (contextPayload as ActiveOrganizationContext).ok
      ? (contextPayload as ActiveOrganizationContext)
      : null;

  const orgName = context?.org_name?.trim() || "";
  const siteName = context?.site_name?.trim() || "";

  const readinessValue = (() => {
    if (!summary) return { text: "—", emphasis: false };
    if (summary.active_total <= 0) {
      return { text: "No active shift issues", emphasis: false };
    }
    const pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(100 - (summary.active_blocking / summary.active_total) * 100)
      )
    );
    return { text: `${pct}%`, emphasis: true };
  })();

  const compliancePctValue = complianceSummary
    ? { text: `${complianceSummary.valid_pct}%`, emphasis: true }
    : { text: "—", emphasis: false };
  const missingValue = complianceSummary
    ? { text: String(complianceSummary.missing_count), emphasis: true }
    : { text: "—", emphasis: false };
  const expiringValue = complianceSummary
    ? { text: String(complianceSummary.expiring_30d_count), emphasis: true }
    : { text: "—", emphasis: false };

  const riskStatus = (() => {
    if (!complianceSummary) return "Unavailable";
    if (complianceSummary.legal_blockers_count > 0) return "High Risk";
    if (complianceSummary.missing_count > 10) return "Elevated Risk";
    return "Stable";
  })();

  const outlookExpiring =
    complianceSummary ? String(complianceSummary.expiring_30d_count) : "—";
  const outlookLegalBlockers =
    complianceSummary ? String(complianceSummary.legal_blockers_count) : "—";
  const outlookMissing =
    complianceSummary ? String(complianceSummary.missing_count) : "—";

  return (
    <PageFrame>
      <div className="space-y-6 pb-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Operational Governance Overview
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Organizational readiness, compliance exposure, and workforce stability.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{displayDate}</span>
            {orgName ? <span>Org: {orgName}</span> : null}
            {siteName ? <span>Site: {siteName}</span> : null}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-muted/30 border-border/60">
            <CardContent className="pt-5 pb-4">
              <div
                className={
                  readinessValue.emphasis
                    ? "text-3xl font-semibold tabular-nums"
                    : "text-sm text-muted-foreground"
                }
              >
                {readinessValue.text}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Operational Readiness
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/60">
            <CardContent className="pt-5 pb-4">
              <div
                className={
                  compliancePctValue.emphasis
                    ? "text-3xl font-semibold tabular-nums"
                    : "text-sm text-muted-foreground"
                }
              >
                {compliancePctValue.text}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Legal Compliance %
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/60">
            <CardContent className="pt-5 pb-4">
              <div
                className={
                  missingValue.emphasis
                    ? "text-3xl font-semibold tabular-nums"
                    : "text-sm text-muted-foreground"
                }
              >
                {missingValue.text}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Employees with Missing Compliance
              </div>
            </CardContent>
          </Card>
          <Card className="bg-muted/30 border-border/60">
            <CardContent className="pt-5 pb-4">
              <div
                className={
                  expiringValue.emphasis
                    ? "text-3xl font-semibold tabular-nums"
                    : "text-sm text-muted-foreground"
                }
              >
                {expiringValue.text}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Expiring (30 days)
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-2">
            <span className="text-sm text-muted-foreground">Risk Level:</span>{" "}
            <span className="text-sm font-medium text-foreground">{riskStatus}</span>
          </div>
        </section>

        <section>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">30-Day Outlook</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>{outlookExpiring} expiring certifications (30 days)</li>
                <li>{outlookLegalBlockers} legal blockers</li>
                <li>{outlookMissing} employees missing compliance</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-border/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Executive Assistant</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                Summarize key risks
              </Button>
              <Button variant="outline" size="sm">
                Generate board-ready summary
              </Button>
              <Button variant="outline" size="sm">
                Create 30-day mitigation plan
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </PageFrame>
  );
}
