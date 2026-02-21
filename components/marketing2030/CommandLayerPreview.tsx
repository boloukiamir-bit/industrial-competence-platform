"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import {
  scaleIn,
  scaleInTransition,
  getPrefersReducedMotion,
  fadeIn,
  fadeInReducedTransition,
} from "@/lib/design/motion";

function DataTickDot({ reducedMotion }: { reducedMotion: boolean }) {
  const [opacity, setOpacity] = useState(1);
  useEffect(() => {
    if (reducedMotion) return;
    const t = setInterval(() => {
      setOpacity((p) => (p === 1 ? 0.55 : 1));
    }, 2200);
    return () => clearInterval(t);
  }, [reducedMotion]);
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)] transition-opacity duration-500"
      style={{ opacity }}
      aria-hidden
    />
  );
}

export function CommandLayerPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.25, once: true });
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(getPrefersReducedMotion());
  }, []);

  const variants = reducedMotion ? fadeIn : scaleIn;
  const transition = reducedMotion ? fadeInReducedTransition : scaleInTransition;

  return (
    <section
      id="chapter-command-preview"
      ref={ref}
      className="py-24 sm:py-32 px-6 sm:px-8 lg:px-12"
      aria-labelledby="command-preview-heading"
    >
      <div className="max-w-3xl mx-auto">
        <h2
          id="command-preview-heading"
          className="font-display text-2xl sm:text-3xl font-normal tracking-tight text-[var(--text)] mb-12 text-center"
        >
          One command layer. Full visibility.
        </h2>
        <motion.div
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={variants}
          transition={transition}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 theme-2030-shadow"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3 mb-4">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
              Command view
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-2)]">
              <DataTickDot reducedMotion={reducedMotion} />
              Live
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            {["Sites", "Shifts", "Legitimacy"].map((label) => (
              <div
                key={label}
                className="py-3 px-2 rounded border border-[var(--border)] bg-[var(--surface-2)]"
              >
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
                  {label}
                </p>
                <p className="mt-1 text-sm font-medium tabular-nums text-[var(--text)]">
                  —
                </p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-[var(--text-3)] text-center">
            Static preview. Real cockpit in app.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
