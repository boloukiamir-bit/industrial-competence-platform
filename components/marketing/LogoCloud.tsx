"use client";

import { useReducedMotion } from "framer-motion";
import { motion } from "./motion";

const PLACEHOLDERS = [
  "Manufacturing Group",
  "Nordic Plant",
  "Panel A",
  "Panel B",
  "Industrial Co.",
  "Site North",
  "Operations Ltd",
  "Production Hub",
];

export function LogoCloud() {
  const reduced = useReducedMotion();

  return (
    <section className="py-10 bg-white border-b border-black/5" aria-label="Trusted by leading organizations">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground mb-8">
          Trusted by operations like yours
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {PLACEHOLDERS.map((label) => (
            <motion.div
              key={label}
              className="rounded-xl px-5 py-2.5 border border-black/8 bg-[#faf8f5] text-muted-foreground text-sm font-medium min-w-[120px] text-center transition-opacity duration-200"
              whileHover={reduced ? undefined : { opacity: 0.85 }}
              transition={{ duration: 0.2 }}
            >
              {label}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
