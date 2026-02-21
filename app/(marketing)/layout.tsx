import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BCLEDGE — Governance Infrastructure for Industrial Execution",
  description:
    "Industrial legitimacy. Validated. Execution without validation is risk. Governance infrastructure for auditable competence and compliance.",
  openGraph: {
    title: "BCLEDGE — Governance Infrastructure",
    description:
      "Industrial legitimacy. Validated. Governance infrastructure for auditable competence, readiness, and compliance.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div data-theme="2030" className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
