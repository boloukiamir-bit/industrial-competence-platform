"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getPrefersReducedMotion } from "@/lib/design/motion";

function PulseDot() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    setReduced(getPrefersReducedMotion());
  }, []);

  return (
    <motion.span
      className="inline-block rounded-full"
      style={{
        width: "6px",
        height: "6px",
        backgroundColor: "#15803D",
        flexShrink: 0,
      }}
      animate={reduced ? {} : { scale: [1, 1.12, 1] }}
      transition={
        reduced
          ? undefined
          : { duration: 2.4, ease: "easeInOut", repeat: Infinity }
      }
      aria-hidden
    />
  );
}

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

  useEffect(() => {
    setReduced(getPrefersReducedMotion());
  }, []);

  const base: React.CSSProperties = {
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
  };

  return (
    <motion.div
      aria-hidden
      style={base}
      animate={reduced ? {} : { y: [0, driftPx, 0] }}
      transition={
        reduced
          ? undefined
          : {
              duration: 14,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "mirror" as const,
            }
      }
    >
      {text}
    </motion.div>
  );
}

const artifactRows = [
  { label: "Operational State", value: "ACTIVE" },
  { label: "Compliance Integrity", value: "100%" },
  { label: "Execution Authority", value: "VALID" },
  { label: "Decision Trail", value: "ENABLED" },
] as const;

const HAIRLINE = "1px solid rgba(15,23,42,0.07)";

export function HeroSection() {
  return (
    <section
      className="relative min-h-screen"
      aria-labelledby="hero-heading"
      style={{ backgroundColor: "var(--bg, #F4F6F8)", overflow: "hidden" }}
    >
      {/* Governance axis */}
      <div
        className="gov-axis hidden lg:block"
        style={{ left: "72px" }}
        aria-hidden
      />

      {/* Atmospheric tonal depth */}
      <div className="hero-atmosphere hidden lg:block" aria-hidden />

      <div
        className="arch-container relative"
        style={{ paddingTop: "152px", paddingBottom: "112px" }}
      >
        {/* Ghost A — LEGITIMACY (primary, brutal) */}
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

        {/* Ghost B — VALIDATED (echo, quieter) */}
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
              <span className="block">Industrial</span>
              <span className="block">legitimacy.</span>
              <span
                className="block"
                style={{ color: "var(--accent, #1E40AF)" }}
              >
                Validated.
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
              Execution without legitimacy is risk.
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
                  backgroundColor: "var(--accent, #1E40AF)",
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
                Request Executive Brief
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
                  transition:
                    "color 0.15s ease, border-color 0.15s ease",
                }}
                onMouseOver={(e) => {
                  const el = e.currentTarget;
                  el.style.color = "var(--text, #0F172A)";
                  el.style.borderBottomColor = "var(--hairline, rgba(15,23,42,0.10))";
                }}
                onMouseOut={(e) => {
                  const el = e.currentTarget;
                  el.style.color = "var(--text-2, #475569)";
                  el.style.borderBottomColor = "transparent";
                }}
              >
                View Command Layer
              </a>
            </div>
          </div>

          {/* Right: Legitimacy Instrument */}
          <div
            className="arch-col-6 flex justify-end"
            style={{ marginTop: "0" }}
          >
            <div
              className="gov-panel gov-panel--elevated w-full"
              style={{ maxWidth: "620px" }}
            >
              {/* Panel header */}
              <div
                style={{
                  padding: "20px 28px 18px",
                  borderBottom: HAIRLINE,
                }}
              >
                <p
                  className="gov-kicker"
                  style={{ fontSize: "10px", letterSpacing: "0.22em" }}
                >
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

              {/* Legitimacy status row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 28px",
                  borderBottom: HAIRLINE,
                }}
              >
                <span
                  className="gov-kicker"
                  style={{ fontSize: "10px", letterSpacing: "0.22em" }}
                >
                  Legitimacy
                </span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 700,
                    letterSpacing: "0.10em",
                    color: "#15803D",
                  }}
                >
                  <PulseDot />
                  VERIFIED
                </span>
              </div>

              {/* Metric rows */}
              <div>
                {artifactRows.map((row, i) => (
                  <div
                    key={row.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 28px",
                      borderBottom:
                        i < artifactRows.length - 1 ? HAIRLINE : "none",
                    }}
                  >
                    <span
                      className="gov-kicker"
                      style={{ fontSize: "10px", letterSpacing: "0.18em" }}
                    >
                      {row.label}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        fontVariantNumeric: "tabular-nums",
                        color: "var(--text, #0F172A)",
                      }}
                    >
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
