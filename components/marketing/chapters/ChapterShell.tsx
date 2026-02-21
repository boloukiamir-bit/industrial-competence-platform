"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, fadeUpReduced } from "@/lib/design/motion";

type BgVariant = "bg" | "surface-2" | "surface-3";

interface ChapterShellProps {
  id: string;
  label: string;
  title: ReactNode;
  subtitle?: string;
  left: ReactNode;
  right: ReactNode;
  bg?: BgVariant;
  /** Flip: artifact on left, text on right */
  flip?: boolean;
  /** Show vertical governance axis spine (desktop only, default true) */
  showAxis?: boolean;
}

const easeOut = [0.33, 1, 0.68, 1] as [number, number, number, number];

function bgValue(bg: BgVariant): string {
  if (bg === "surface-2") return "var(--surface-2, #F9FAFB)";
  if (bg === "surface-3") return "var(--surface-3, #F2F4F7)";
  return "var(--bg, #F4F6F8)";
}

export function ChapterShell({
  id,
  label,
  title,
  subtitle,
  left,
  right,
  bg = "bg",
  flip = false,
  showAxis = true,
}: ChapterShellProps) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }
  }, []);

  const variants = reducedMotion ? fadeUpReduced : fadeUp;

  return (
    <section
      id={id}
      ref={ref}
      style={{
        position: "relative",
        backgroundColor: bgValue(bg),
        borderTop: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))",
      }}
    >
      {/* Continuous governance axis — matches hero axis at 72px from viewport left.
          The arch-container has 80px left padding on desktop, so the axis sits
          8px inside the container edge — matching the hero's absolute position. */}
      {showAxis && (
        <div
          className="gov-axis hidden lg:block"
          style={{ left: "72px" }}
          aria-hidden
        />
      )}

      <div
        className="arch-container relative"
        style={{ paddingTop: "128px", paddingBottom: "128px" }}
      >
        {/* Chapter kicker */}
        <motion.p
          className="gov-kicker"
          variants={variants}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          transition={{ duration: 0.55, ease: easeOut }}
          style={{ marginBottom: "44px" }}
        >
          {label}
        </motion.p>

        {/* 12-column content grid */}
        <div
          className="arch-grid"
          style={{ alignItems: "start", rowGap: "56px" }}
        >
          {/* Left column */}
          <div className="arch-col-6" style={{ order: flip ? 2 : 1 }}>
            <motion.div
              variants={variants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ duration: 0.7, ease: easeOut, delay: 0.06 }}
            >
              <div
                style={{
                  fontSize: "clamp(1.875rem, 3.8vw, 3.25rem)",
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: "-0.025em",
                  color: "var(--text, #0F172A)",
                }}
              >
                {title}
              </div>
              {subtitle && (
                <p
                  style={{
                    marginTop: "18px",
                    fontSize: "1rem",
                    lineHeight: 1.65,
                    color: "var(--text-2, #475569)",
                    maxWidth: "460px",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </motion.div>

            {left && (
              <motion.div
                variants={variants}
                initial="hidden"
                animate={inView ? "visible" : "hidden"}
                transition={{ duration: 0.7, ease: easeOut, delay: 0.14 }}
                style={{ marginTop: "44px" }}
              >
                {left}
              </motion.div>
            )}
          </div>

          {/* Right column */}
          <div className="arch-col-6" style={{ order: flip ? 1 : 2 }}>
            <motion.div
              variants={variants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ duration: 0.75, ease: easeOut, delay: 0.18 }}
            >
              {right}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
