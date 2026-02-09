import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "BCLEDGE — The system of record for industrial competence and compliance",
  description:
    "Auditable competence, readiness, and compliance for industrial organizations. Single source of truth, skills-to-stations logic, audit-grade compliance. Sweden and EU-ready.",
  openGraph: {
    title: "BCLEDGE — Industrial competence and compliance",
    description:
      "The system of record for industrial competence and compliance. Built for auditability, pilot-ready in weeks.",
    type: "website",
  },
};

export default function MarketingLayout({
  children,
}: { children: React.ReactNode }) {
  return (
    <div className={`${instrumentSerif.variable} font-sans`}>
      {children}
    </div>
  );
}
