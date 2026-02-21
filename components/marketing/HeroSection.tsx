"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPrefersReducedMotion } from "@/lib/design/motion";

/* ── Ghost typography layers ── */

function GhostLayer({
  text,
  style,
  driftPx,
}: {
  text: string;
  style: React.CSSProperties;
  driftPx: number;
}) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => { setReduced(getPrefersReducedMotion()); }, []);

  return (
    <motion.div
      aria-hidden
      style={{
        position: "absolute",
        fontWeight: 900,
        lineHeight: 0.85,
        color: "var(--text, #0F172A)",
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 0,
        whiteSpace: "nowrap",
        transform: "translateZ(0)",
        ...style,
      }}
      animate={reduced ? {} : { y: [0, driftPx, 0] }}
      transition={
        reduced
          ? undefined
          : { duration: 14, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" as const }
      }
    >
      {text}
    </motion.div>
  );
}

/* ── Instrument panel: 2-state risk→control loop ── */

type InstrumentState = {
  legitimacy: { label: string; color: string };
  compliance: string;
  evidence: string;
  note: string;
};

const STATE_RISK: InstrumentState = {
  legitimacy: { label: "WARNING", color: "#B45309" },
  compliance: "92%",
  evidence: "1 item",
  note: "Verification incomplete",
};

const STATE_CONTROLLED: InstrumentState = {
  legitimacy: { label: "VERIFIED", color: "#15803D" },
  compliance: "100%",
  evidence: "0 items",
  note: "Verification complete",
};

const HAIRLINE = "1px solid rgba(15,23,42,0.07)";
const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 28px",
};
const LABEL_STYLE: React.CSSProperties = {
  fontSize: "10px",
  letterSpacing: "0.18em",
};
const VALUE_STYLE: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "0.08em",
  fontVariantNumeric: "tabular-nums",
  color: "var(--text, #0F172A)",
};

function InstrumentPanel() {
  const [reduced, setReduced] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [isRisk, setIsRisk] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const r = getPrefersReducedMotion();
    setReduced(r);
    if (r) return;

    const startTimeout = setTimeout(() => {
      setIsRisk(true);
      const interval = setInterval(() => setIsRisk((v) => !v), 5500);
      cleanupRef.current = () => clearInterval(interval);
    }, 1200);

    const cleanupRef = { current: () => {} };
    return () => {
      clearTimeout(startTimeout);
      cleanupRef.current();
    };
  }, []);

  const looping = hydrated && !reduced;
  const s = isRisk ? STATE_RISK : STATE_CONTROLLED;

  const fadeProps = useCallback(
    () =>
      !looping
        ? {}
        : {
            initial: { opacity: 0 } as const,
            animate: { opacity: 1 } as const,
            exit: { opacity: 0 } as const,
            transition: { duration: 0.6, ease: "easeInOut" as const },
          },
    [looping]
  );

  return (
    <div
      className="gov-panel gov-panel--elevated w-full"
      style={{ maxWidth: "620px" }}
    >
      {/* Header */}
      <div style={{ padding: "20px 28px 18px", borderBottom: HAIRLINE }}>
        <p className="gov-kicker" style={{ fontSize: "10px", letterSpacing: "0.22em" }}>
          Entity
        </p>
        <p
          style={{
            marginTop: "6px",
            fontSize: "1.0625rem",
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: "var(--text, #0F172A)",
          }}
        >
          Northern Energy Grid
        </p>
      </div>

      {/* Legitimacy status */}
      <div style={{ ...ROW_STYLE, borderBottom: HAIRLINE }}>
        <span className="gov-kicker" style={{ fontSize: "10px", letterSpacing: "0.22em" }}>
          Legitimacy
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={s.legitimacy.label}
            {...fadeProps()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: s.legitimacy.color,
            }}
          >
            <span
              className="inline-block rounded-full"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: s.legitimacy.color,
                flexShrink: 0,
              }}
            />
            {s.legitimacy.label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Compliance Integrity */}
      <div style={{ ...ROW_STYLE, borderBottom: HAIRLINE }}>
        <span className="gov-kicker" style={LABEL_STYLE}>Compliance Integrity</span>
        <AnimatePresence mode="wait">
          <motion.span key={s.compliance} {...fadeProps()} style={VALUE_STYLE}>
            {s.compliance}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Evidence missing */}
      <div style={{ ...ROW_STYLE, borderBottom: HAIRLINE }}>
        <span className="gov-kicker" style={LABEL_STYLE}>Evidence Missing</span>
        <AnimatePresence mode="wait">
          <motion.span key={s.evidence} {...fadeProps()} style={VALUE_STYLE}>
            {s.evidence}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Decision Trail — always ENABLED */}
      <div style={{ ...ROW_STYLE, borderBottom: HAIRLINE }}>
        <span className="gov-kicker" style={LABEL_STYLE}>Decision Trail</span>
        <span style={VALUE_STYLE}>ENABLED</span>
      </div>

      {/* Note line */}
      <div style={{ padding: "14px 28px" }}>
        <AnimatePresence mode="wait">
          <motion.p
            key={s.note}
            {...fadeProps()}
            className="gov-kicker"
            style={{ fontSize: "10px", letterSpacing: "0.14em" }}
          >
            {s.note}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Hero section ── */

export function HeroSection() {
  return (
    <section
      className="relative min-h-screen"
      aria-labelledby="hero-heading"
      style={{ backgroundColor: "var(--bg, #F4F6F8)", overflow: "hidden" }}
    >
      <div className="gov-axis hidden lg:block" style={{ left: "72px" }} aria-hidden />
      <div className="hero-atmosphere hidden lg:block" aria-hidden />

      <div
        className="arch-container relative"
        style={{ paddingTop: "152px", paddingBottom: "112px" }}
      >
        <GhostLayer
          text="LEGITIMACY"
          driftPx={12}
          style={{
            left: "-60px",
            top: "20px",
            fontSize: "clamp(10rem, 22vw, 26rem)",
            letterSpacing: "-0.04em",
            opacity: 0.045,
          }}
        />
        <GhostLayer
          text="VALIDATED"
          driftPx={-8}
          style={{
            left: "10%",
            top: "220px",
            fontSize: "clamp(6rem, 14vw, 18rem)",
            letterSpacing: "-0.05em",
            opacity: 0.02,
          }}
        />

        <div
          className="arch-grid"
          style={{ alignItems: "center", position: "relative", zIndex: 10 }}
        >
          {/* Left: headline block */}
          <div className="arch-col-6 flex flex-col">
            <p className="gov-kicker">Governance Infrastructure</p>

            <h1
              id="hero-heading"
              style={{
                marginTop: "20px",
                fontSize: "clamp(2.75rem, 5.8vw, 6.25rem)",
                fontWeight: 800,
                lineHeight: 1.03,
                letterSpacing: "-0.025em",
                color: "var(--text, #0F172A)",
              }}
            >
              <span className="block">Legitimacy is</span>
              <span className="block">not declared.</span>
              <span className="block" style={{ color: "var(--color-accent, #1E40AF)" }}>
                It is computed.
              </span>
            </h1>

            <p
              style={{
                marginTop: "24px",
                fontSize: "1.0625rem",
                lineHeight: 1.65,
                color: "var(--text-2, #475569)",
                maxWidth: "440px",
              }}
            >
              Execution without verification creates invisible risk.
            </p>

            {/* CTA pair */}
            <div
              style={{
                marginTop: "36px",
                display: "flex",
                alignItems: "center",
                gap: "14px",
                flexWrap: "wrap",
              }}
            >
              <Link
                href="#request-brief"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "13px 28px",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                  color: "#fff",
                  backgroundColor: "var(--color-accent, #1E40AF)",
                  borderRadius: "3px",
                  textDecoration: "none",
                  transition: "opacity 0.18s ease",
                }}
                onMouseOver={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.88")
                }
                onMouseOut={(e) =>
                  ((e.currentTarget as HTMLAnchorElement).style.opacity = "1")
                }
              >
                See your risk surface
              </Link>
              <a
                href="#chapter-output"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "var(--text-2, #475569)",
                  textDecoration: "none",
                  paddingBottom: "2px",
                  borderBottom: "1px solid transparent",
                  transition: "color 0.15s ease, border-color 0.15s ease",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.color = "var(--text, #0F172A)";
                  e.currentTarget.style.borderBottomColor = "var(--hairline, rgba(15,23,42,0.10))";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.color = "var(--text-2, #475569)";
                  e.currentTarget.style.borderBottomColor = "transparent";
                }}
              >
                View Command Layer
              </a>
            </div>

            {/* Micro-copy */}
            <p
              style={{
                marginTop: "16px",
                fontSize: "0.75rem",
                letterSpacing: "0.02em",
                color: "var(--text-3, #94A3B8)",
              }}
            >
              No marketing. Audit-grade outputs.
            </p>
          </div>

          {/* Right: Legitimacy Instrument (risk→control loop) */}
          <div className="arch-col-6 flex justify-end" style={{ marginTop: "0" }}>
            <InstrumentPanel />
          </div>
        </div>
      </div>
    </section>
  );
}
