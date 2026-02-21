"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  fadeUp,
  fadeUpTransition,
  fadeIn,
  fadeInTransition,
  getPrefersReducedMotion,
  fadeUpReduced,
  fadeInReducedTransition,
} from "@/lib/design/motion";
import { LegitimacyArtifact } from "./LegitimacyArtifact";
import { useRef, useState, useEffect } from "react";

export function HeroInstrument() {
  const [reducedMotion, setReducedMotion] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReducedMotion(getPrefersReducedMotion());
  }, []);

  const titleVariants = reducedMotion ? fadeUpReduced : fadeUp;
  const titleTransition = reducedMotion ? { duration: 0.4 } : fadeUpTransition;
  const subVariants = reducedMotion ? fadeUpReduced : fadeIn;
  const subTransition = reducedMotion ? fadeInReducedTransition : fadeInTransition;

  return (
    <section
      id="chapter-hero"
      ref={ref}
      className="relative min-h-screen flex flex-col justify-center px-6 sm:px-8 lg:px-12 pt-24 pb-20 overflow-hidden"
      aria-labelledby="hero-heading"
    >
      {/* Subtle tonal drift — faint radial, no blobs */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <div
          className="absolute top-1/4 right-0 w-[80%] max-w-2xl h-[60vh] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 left-0 w-[60%] max-w-xl h-[40vh] rounded-full opacity-[0.03]"
          style={{ background: "radial-gradient(circle, var(--text) 0%, transparent 70%)" }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-12 lg:gap-16 items-center">
        <div className="flex flex-col gap-6">
          <motion.h1
            id="hero-heading"
            variants={titleVariants}
            initial="hidden"
            animate="visible"
            transition={titleTransition}
            className="font-display text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-normal tracking-tight text-[var(--text)] leading-[1.08] max-w-2xl"
          >
            <span className="block">Industrial Legitimacy.</span>
            <span className="block">Validated.</span>
          </motion.h1>
          <motion.p
            variants={subVariants}
            initial="hidden"
            animate="visible"
            transition={{ ...subTransition, delay: 0.15 }}
            className="text-lg sm:text-xl text-[var(--text-2)] max-w-lg leading-relaxed"
          >
            Execution without validation is risk.
          </motion.p>
          <motion.div
            variants={subVariants}
            initial="hidden"
            animate="visible"
            transition={{ ...subTransition, delay: 0.25 }}
            className="flex flex-wrap gap-3 mt-2"
          >
            <Link
              href="#request-brief"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
            >
              Request Executive Brief
            </Link>
            <Link
              href="/app/cockpit"
              className="inline-flex items-center justify-center px-6 py-3 rounded-md text-sm font-medium text-[var(--text)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition-colors"
            >
              See the Command View
            </Link>
          </motion.div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <LegitimacyArtifact />
        </div>
      </div>
    </section>
  );
}
