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
  Building2,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroNav } from "./HeroNav";
import { HeroCommandPreview } from "./HeroCommandPreview";
import { MarketingFooter } from "./MarketingFooter";
import { AuthRedirectToCockpit } from "./AuthRedirectToCockpit";

const container = "w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-12";

/* ----- Hero ----- */
function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col bg-white overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Very subtle tonal wash — professional, not decorative */}
      <div
        className="absolute top-0 right-0 w-[60%] max-w-xl h-[50%] bg-slate-100/40 pointer-events-none"
        aria-hidden
      />
      <HeroNav />
      <div className={`${container} flex-1 flex flex-col lg:flex-row items-start gap-16 lg:gap-20 pt-36 pb-24 lg:pt-44 lg:pb-28 relative z-10`}>
        <div className="flex-1 w-full max-w-xl">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
            Execution legitimacy infrastructure
          </p>
          <h1
            id="hero-heading"
            className="mt-5 text-[2.25rem] sm:text-[2.75rem] lg:text-[3rem] font-semibold tracking-tight text-slate-900 leading-[1.15]"
          >
            <span className="block">Run tomorrow&apos;s shift</span>
            <span className="block">
              <span className="text-primary">legally</span> and fully staffed.
            </span>
          </h1>
          <p className="mt-6 text-base text-slate-600 leading-relaxed max-w-md font-normal">
            One command layer for skills, compliance, and staffing — with
            audit-grade traceability for boards, operations, and HR.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <Button asChild size="lg" className="rounded-md font-medium">
              <Link href="#book-demo">Book demo</Link>
            </Button>
            <Link
              href="#platform-tour"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              See platform tour
            </Link>
          </div>
          <ul
            className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-[13px] text-slate-600"
            aria-label="Trust points"
          >
            <li className="flex items-center gap-2.5">
              <ClipboardCheck className="h-4 w-4 text-slate-500 shrink-0" />
              Audit trail by default
            </li>
            <li className="flex items-center gap-2.5">
              <CalendarClock className="h-4 w-4 text-slate-500 shrink-0" />
              Compliance deadlines tracked
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0" />
              Execution-ready decisions, traceable
            </li>
          </ul>
        </div>
        <div className="flex-shrink-0 w-full max-w-[400px] min-h-[300px] flex items-center justify-center lg:justify-end">
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
    <section className="py-24 sm:py-28 bg-slate-50/80" aria-labelledby="pain-promise-heading">
      <div className={container}>
        <h2
          id="pain-promise-heading"
          className="text-xl sm:text-2xl font-semibold text-slate-900 text-center mb-14 tracking-tight"
        >
          From firefighting to control
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          {PAIN_PROMISE.map((item, i) => (
            <motion.article
              key={item.promise}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3 }}
              className="rounded-lg border border-slate-200/80 bg-white py-6 px-5"
            >
              <p className="text-[13px] text-slate-400 line-through">{item.pain}</p>
              <p className="mt-2 text-[15px] font-medium text-slate-900 leading-snug">{item.promise}</p>
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
    <section id="product" className="py-24 sm:py-28 bg-white scroll-mt-20" aria-labelledby="how-heading">
      <div className={container}>
        <h2
          id="how-heading"
          className="text-xl sm:text-2xl font-semibold text-slate-900 text-center mb-14 tracking-tight"
        >
          How it works
        </h2>
        <div className="grid sm:grid-cols-3 gap-10">
          {STEPS.map((step, i) => (
            <motion.article
              key={step.title}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="border-b border-slate-200/80 pb-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                  <step.icon className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Step {i + 1}</span>
              </div>
              <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed">{step.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----- Who it serves: board, MD, COO, HR, operations ----- */
const LEADERSHIP_OUTCOMES = [
  "Board and MD: one source of truth for execution legitimacy",
  "COO and operations: daily readiness, no-go prevention, rapid decisions",
  "HR and compliance: audit trail, expiring certs, templates and jobs",
];

function AudiencesSection() {
  return (
    <section id="solutions" className="py-24 sm:py-28 bg-slate-50/80 scroll-mt-20" aria-labelledby="audiences-heading">
      <div className={container}>
        <h2
          id="audiences-heading"
          className="text-xl sm:text-2xl font-semibold text-slate-900 text-center mb-4 tracking-tight"
        >
          Built for leadership and operations
        </h2>
        <p className="text-center text-slate-600 text-[15px] max-w-xl mx-auto mb-12">
          Execution legitimacy infrastructure for industrial operations — from board and MD to COO, HR, and the floor.
        </p>
        <div className="max-w-2xl mx-auto space-y-5">
          {LEADERSHIP_OUTCOMES.map((line, i) => (
            <div
              key={line}
              className="flex items-start gap-3 rounded-lg border border-slate-200/80 bg-white py-4 px-5"
            >
              {i === 0 && <Building2 className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />}
              {i === 1 && <Scale className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />}
              {i === 2 && <ClipboardCheck className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />}
              <p className="text-[14px] text-slate-700 leading-relaxed">{line}</p>
            </div>
          ))}
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
      className="py-24 sm:py-28 bg-white scroll-mt-20 border-t border-slate-200/80"
      aria-labelledby="final-cta-heading"
    >
      <div id="request-brief" className={container}>
        <div className="max-w-xl mx-auto text-center">
          <h2
            id="final-cta-heading"
            className="text-xl sm:text-2xl font-semibold text-slate-900 tracking-tight"
          >
            Stop firefighting. Start managing.
          </h2>
          <p className="mt-3 text-[15px] text-slate-600">
            Book a demo and see the command layer in action.
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="rounded-md font-medium">
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
    <main className="min-h-screen flex flex-col bg-white">
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
