import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Governance Infrastructure (2030) — BCLEDGE",
  description:
    "Industrial legitimacy. Validated. Execution without validation is risk. Governance infrastructure for industrial execution.",
};

export default function Layout2030({
  children,
}: { children: React.ReactNode }) {
  return (
    <div
      data-theme="2030"
      className="min-h-screen bg-background text-foreground"
    >
      {children}
    </div>
  );
}
