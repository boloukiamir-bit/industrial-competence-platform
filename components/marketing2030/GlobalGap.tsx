"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";

export function GlobalGap() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4, once: true });
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  return (
    <section
      id="chapter-global-gap"
      ref={ref}
      className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12"
      aria-labelledby="global-gap-heading"
    >
      <div className="max-w-2xl mx-auto text-center">
        <h2
          id="global-gap-heading"
          className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text)] leading-snug"
        >
          The gap between workforce systems and auditable legitimacy is where
          execution risk lives.
        </h2>
        <div className="mt-10 flex justify-center">
          {reducedMotion ? (
            <div className="h-px w-40 bg-[var(--accent)]" />
          ) : (
            <motion.div
              className="h-px w-40 bg-[var(--accent)]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: inView ? 1 : 0 }}
              transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
              style={{ transformOrigin: "center" }}
            />
          )}
        </div>
      </div>
    </section>
  );
}
