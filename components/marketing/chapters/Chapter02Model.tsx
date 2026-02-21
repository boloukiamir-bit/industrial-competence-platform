"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, fadeUpReduced } from "@/lib/design/motion";
import { ChapterShell } from "./ChapterShell";

const stackLayers = [
  { label: "Foundation", sublabel: "Infrastructure & identity" },
  { label: "Competence", sublabel: "Skills, levels, ownership" },
  { label: "Compliance", sublabel: "Regulatory mapping" },
  { label: "Execution", sublabel: "Real-time validation" },
  { label: "Legitimacy", sublabel: "Computed, auditable state" },
] as const;

const easeOut = [0.33, 1, 0.68, 1] as [number, number, number, number];
const HAIRLINE = "1px solid rgba(15,23,42,0.06)";
const AXIS_COLOR = "rgba(15,23,42,0.06)";

function GovernanceStack() {
  const ref = useRef<HTMLDivElement>(null);
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
    <div className="gov-panel gov-panel--elevated" ref={ref} style={{ position: "relative" }}>
      {/* Structural axis inside the panel — mirrors the page spine */}
      <div
        style={{
          position: "absolute",
          left: "48px",
          top: 0,
          bottom: 0,
          width: "1px",
          backgroundColor: AXIS_COLOR,
          pointerEvents: "none",
        }}
        aria-hidden
      />

      {stackLayers.map((layer, i) => {
        const isLast = layer.label === "Legitimacy";
        return (
          <motion.div
            key={layer.label}
            variants={variants}
            initial="hidden"
            animate={inView ? "visible" : "hidden"}
            transition={{
              duration: 0.65,
              ease: easeOut,
              delay: reducedMotion ? 0 : 0.09 * i,
            }}
            style={{
              display: "grid",
              gridTemplateColumns: "48px 1fr auto",
              alignItems: "center",
              borderBottom: i < stackLayers.length - 1 ? HAIRLINE : "none",
              backgroundColor: isLast
                ? "rgba(30,64,175,0.025)"
                : "transparent",
            }}
          >
            {/* Layer number — left of axis */}
            <div
              style={{
                padding: "18px 0 18px 20px",
                fontSize: "10px",
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.08em",
                color: isLast
                  ? "var(--accent, #1E40AF)"
                  : "var(--text-3, #94A3B8)",
              }}
            >
              {String(i + 1).padStart(2, "0")}
            </div>

            {/* Layer text — right of axis */}
            <div style={{ padding: "18px 20px 18px 16px" }}>
              <p
                style={{
                  fontSize: "0.9375rem",
                  fontWeight: isLast ? 700 : 600,
                  letterSpacing: "-0.01em",
                  color: isLast
                    ? "var(--accent, #1E40AF)"
                    : "var(--text, #0F172A)",
                  margin: 0,
                  lineHeight: 1.3,
                }}
              >
                {layer.label}
              </p>
              <p
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-3, #94A3B8)",
                  margin: "2px 0 0",
                  lineHeight: 1.4,
                }}
              >
                {layer.sublabel}
              </p>
            </div>

            {/* Status — rightmost */}
            <div style={{ padding: "18px 20px 18px 0" }}>
              {isLast && (
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--accent, #1E40AF)",
                  }}
                >
                  Output
                </span>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export function Chapter02Model() {
  return (
    <ChapterShell
      id="chapter-model"
      label="The Model"
      title={
        <>
          <span style={{ display: "block" }}>Legitimacy is</span>
          <span style={{ display: "block" }}>a computed state.</span>
        </>
      }
      subtitle="Deterministic validation for high-stakes execution."
      left={null}
      right={<GovernanceStack />}
      bg="surface-2"
    />
  );
}
