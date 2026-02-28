"use client";

import Link from "next/link";
import { GovernanceStateCard } from "./GovernanceStateCard";

export function HeroInstrument() {
  return (
    <section
      id="chapter-hero"
      className="relative flex flex-col justify-center px-6 sm:px-8 lg:px-12 pt-24 pb-[120px] min-h-screen"
      style={{ backgroundColor: "#F9FAFB" }}
      aria-labelledby="hero-heading"
    >
      <div className="relative max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-16 lg:gap-20 items-center">
        <div className="flex flex-col gap-10">
          <p
            id="hero-eyebrow"
            className="text-[11px] font-medium uppercase tracking-[0.25em]"
            style={{ color: "#6B7280" }}
          >
            INDUSTRIAL GOVERNANCE INFRASTRUCTURE
          </p>
          <h1
            id="hero-heading"
            className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-6xl font-bold tracking-tight leading-[1.06] max-w-2xl"
          >
            <span className="block" style={{ color: "#0B1220" }}>
              Legitimacy is not declared.
            </span>
            <span className="block" style={{ color: "#1D4ED8" }}>
              It is computed.
            </span>
          </h1>
          <p
            className="text-lg max-w-xl leading-relaxed"
            style={{ color: "#6B7280" }}
          >
            Before a shift executes, BCLEDGE verifies staffing, certifications,
            operational constraints, and governance bindings — producing an
            executable legitimacy state.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Link
                href="#request-brief"
                className="inline-flex items-center justify-center px-6 py-3 rounded text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1D4ED8" }}
              >
                Request Executive Brief
              </Link>
              <Link
                href="/app/cockpit"
                className="inline-flex items-center justify-center px-6 py-3 rounded text-sm font-medium border bg-transparent transition-colors hover:bg-[rgba(11,18,32,0.04)]"
                style={{
                  color: "#0B1220",
                  borderColor: "#E5E7EB",
                }}
              >
                Explore Command Layer
              </Link>
            </div>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Audit-grade outputs. Zero marketing abstraction.
            </p>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <GovernanceStateCard />
        </div>
      </div>
    </section>
  );
}
