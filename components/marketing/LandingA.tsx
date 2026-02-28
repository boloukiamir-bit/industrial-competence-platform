"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ClipboardCheck,
  CalendarClock,
  ShieldCheck,
  Upload,
  Link2,
  Cpu,
  Users,
  Factory,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroNav } from "./HeroNav";
import { HeroCommandPreview } from "./HeroCommandPreview";
import { MarketingFooter } from "./MarketingFooter";
import { AuthRedirectToCockpit } from "./AuthRedirectToCockpit";

const container = "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";

/* ----- Hero ----- */
function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col bg-slate-50 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Subtle gradient wash top-right */}
      <div
        className="absolute top-0 right-0 w-[80%] max-w-2xl h-[70%] bg-primary/5 blur-3xl pointer-events-none"
        aria-hidden
      />
      <HeroNav />
      <div className={`${container} flex-1 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 pt-32 pb-20 lg:pt-40 lg:pb-24 relative z-10`}>
        <div className="flex-1 w-full max-w-xl">
          <p className="inline-block rounded-full bg-slate-200/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            The Industrial Command Center
          </p>
          <h1
            id="hero-heading"
            className="mt-4 text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-slate-900 leading-[1.1]"
          >
            <span className="block">Run tomorrow&apos;s shift</span>
            <span className="block">
              <span className="bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                legally
              </span>{" "}
              and fully staffed.
            </span>
          </h1>
          <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-md">
            Skills + compliance + staffing decisions in one command layer — with
            audit-grade traceability.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="rounded-xl">
              <Link href="#book-demo">Book demo</Link>
            </Button>
            <Link
              href="#platform-tour"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
            >
              See platform tour
            </Link>
          </div>
          <ul
            className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-600"
            aria-label="Trust points"
          >
            <li className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              Audit trail by default
            </li>
            <li className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-emerald-600 shrink-0" />
              Compliance deadlines tracked
            </li>
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              Plant-ready staffing decisions
            </li>
          </ul>
        </div>
        <div className="flex-shrink-0 w-full max-w-[420px] min-h-[320px] flex items-center justify-center lg:justify-end">
          <HeroCommandPreview />
        </div>
      </div>
    </section>
  );
}

/* ----- Pain → Promise (3 cards) ----- */
const PAIN_PROMISE = [
  {
    pain: "Spreadsheets and guesswork",
    promise: "One command layer with live readiness",
  },
  {
    pain: "Last-minute no-shows and coverage gaps",
    promise: "Tomorrow’s gaps visible today",
  },
  {
    pain: "Audit panic and missing evidence",
    promise: "Audit trail and decisions logged by default",
  },
];

function PainPromiseSection() {
  return (
    <section className="py-20 sm:py-24 bg-white" aria-labelledby="pain-promise-heading">
      <div className={container}>
        <h2
          id="pain-promise-heading"
          className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12"
        >
          From firefighting to control
        </h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {PAIN_PROMISE.map((item, i) => (
            <motion.article
              key={item.promise}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm"
            >
              <p className="text-sm text-slate-500 line-through">{item.pain}</p>
              <p className="mt-2 text-base font-semibold text-slate-900">{item.promise}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----- How it works (3 steps) ----- */
const STEPS = [
  {
    title: "Import",
    description: "CSV or API — people, roles, skills, and compliance data.",
    icon: Upload,
  },
  {
    title: "Bind requirements",
    description: "Roles, skills, and compliance rules tied to stations and shifts.",
    icon: Link2,
  },
  {
    title: "Compute readiness + decisions",
    description: "Daily readiness and recommended actions with full traceability.",
    icon: Cpu,
  },
];

function HowItWorksSection() {
  return (
    <section id="product" className="py-20 sm:py-24 bg-slate-50 scroll-mt-20" aria-labelledby="how-heading">
      <div className={container}>
        <h2
          id="how-heading"
          className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12"
        >
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <motion.article
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold text-slate-500">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{step.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----- For HR + For Plant Managers ----- */
const HR_OUTCOMES = [
  "Compliance visibility",
  "Expiring certs",
  "Audit trail",
  "Templates / jobs",
];

const OPS_OUTCOMES = [
  "Coverage",
  "No-go prevention",
  "Rapid swaps",
  "Daily command view",
];

function AudiencesSection() {
  return (
    <section id="solutions" className="py-20 sm:py-24 bg-white scroll-mt-20" aria-labelledby="audiences-heading">
      <div className={container}>
        <h2
          id="audiences-heading"
          className="text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12"
        >
          For HR + For Plant Managers
        </h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-slate-900">HR & Compliance</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              {HR_OUTCOMES.map((o) => (
                <li key={o}>• {o}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Factory className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-slate-900">Plant Manager / Ops</h3>
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              {OPS_OUTCOMES.map((o) => (
                <li key={o}>• {o}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----- Final CTA ----- */
function FinalCTASection() {
  return (
    <section
      id="book-demo"
      className="py-20 sm:py-24 bg-slate-50 scroll-mt-20"
      aria-labelledby="final-cta-heading"
    >
      <div id="request-brief" className={container}>
        <div className="max-w-2xl mx-auto text-center">
          <h2
            id="final-cta-heading"
            className="text-2xl sm:text-4xl font-bold text-slate-900"
          >
            Stop firefighting. Start managing.
          </h2>
          <p className="mt-4 text-slate-600">
            Book a demo and see the command layer in action.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-xl">
              <Link href="#book-demo">Book demo</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingA() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-50">
      <AuthRedirectToCockpit />
      <Hero />
      <PainPromiseSection />
      <HowItWorksSection />
      <AudiencesSection />
      <FinalCTASection />
      <MarketingFooter />
    </main>
  );
}
