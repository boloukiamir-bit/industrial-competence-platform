"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getPrefersReducedMotion } from "@/lib/design/motion";

const STATUS = "VERIFIED" as const;
const INTEGRITY = "98";
const AUTHORITY = "VALID";
const TRAIL = "ENABLED";
const ENTITY = "Entity: Northern Energy Grid";

function TickDot({ reducedMotion }: { reducedMotion: boolean }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (reducedMotion) return;
    const t = setInterval(() => {
      setOpacity((p) => (p === 1 ? 0.5 : 1));
    }, 2800);
    return () => clearInterval(t);
  }, [reducedMotion]);

  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--go)] transition-opacity duration-500"
      style={{ opacity }}
      aria-hidden
    />
  );
}

export function LegitimacyArtifact() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(getPrefersReducedMotion());
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, ease: [0.33, 1, 0.68, 1] }}
      className="w-full max-w-[320px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 theme-2030-shadow transition-all duration-300 hover:border-[var(--text-3)] hover:shadow-[0_8px_32px_rgba(15,23,42,0.08)]"
    >
      <div className="space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
            Entity
          </p>
          <p className="mt-0.5 text-sm font-medium text-[var(--text)]">
            {ENTITY}
          </p>
        </div>
        <div className="h-px bg-[var(--border)]" />
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-3)]">
            Legitimacy
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--go)]">
            <TickDot reducedMotion={reducedMotion} />
            {STATUS}
          </span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="uppercase tracking-widest text-[var(--text-3)]">
            Compliance integrity
          </span>
          <span className="tabular-nums text-[var(--text)]">{INTEGRITY}%</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="uppercase tracking-widest text-[var(--text-3)]">
            Execution authority
          </span>
          <span className="text-[var(--text)]">{AUTHORITY}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="uppercase tracking-widest text-[var(--text-3)]">
            Decision trail
          </span>
          <span className="text-[var(--text)]">{TRAIL}</span>
        </div>
      </div>
    </motion.div>
  );
}
