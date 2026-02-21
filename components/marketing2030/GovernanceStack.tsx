"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import {
  fadeUp,
  fadeUpTransition,
  getPrefersReducedMotion,
  fadeUpReduced,
  fadeInReducedTransition,
} from "@/lib/design/motion";
import { useState, useEffect } from "react";

const STACK = [
  "Foundation",
  "Competence",
  "Compliance",
  "Execution",
  "Legitimacy",
] as const;

export function GovernanceStack() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2, once: true });
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(getPrefersReducedMotion());
  }, []);

  const variants = reducedMotion ? fadeUpReduced : fadeUp;
  const transition = reducedMotion
    ? fadeInReducedTransition
    : { ...fadeUpTransition, staggerChildren: 0.1, delayChildren: 0.05 };

  return (
    <section
      id="chapter-governance-stack"
      ref={ref}
      className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12"
      aria-labelledby="governance-stack-heading"
    >
      <div className="max-w-md mx-auto">
        <h2
          id="governance-stack-heading"
          className="sr-only"
        >
          Governance stack
        </h2>
        <div className="relative flex flex-col items-center">
          {/* Center line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-px bg-[var(--border)]"
            aria-hidden
          />
          {STACK.map((label, i) => (
            <motion.div
              key={label}
              className="relative flex items-center justify-center py-4 w-full"
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              variants={variants}
              transition={{
                ...transition,
                delay: reducedMotion ? 0 : i * 0.1,
              }}
            >
              <span className="text-sm font-medium tracking-wide text-[var(--text-2)] bg-background px-4">
                {label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
