"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, fadeUpTransition, getPrefersReducedMotion, fadeUpReduced, fadeInReducedTransition } from "@/lib/design/motion";
import { useState, useEffect } from "react";

export function CategoryMicDrop() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: true });
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    setReducedMotion(getPrefersReducedMotion());
  }, []);

  const variants = reducedMotion ? fadeUpReduced : fadeUp;
  const transition = reducedMotion ? fadeInReducedTransition : fadeUpTransition;

  return (
    <section
      id="chapter-mic-drop"
      ref={ref}
      className="py-28 sm:py-36 px-6 sm:px-8 lg:px-12"
      aria-labelledby="mic-drop-heading"
    >
      <div className="max-w-4xl mx-auto text-center">
        <motion.p
          id="mic-drop-heading"
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={variants}
          transition={transition}
          className="font-display text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-[var(--text)] leading-snug"
        >
          Workforce systems manage people.
        </motion.p>
        <motion.p
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          variants={variants}
          transition={{ ...transition, delay: 0.12 }}
          className="mt-4 font-display text-2xl sm:text-3xl lg:text-4xl font-normal tracking-tight text-[var(--accent)] leading-snug"
        >
          BCLEDGE validates execution legitimacy.
        </motion.p>
      </div>
    </section>
  );
}
