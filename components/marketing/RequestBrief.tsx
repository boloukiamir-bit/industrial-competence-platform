"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUp, fadeUpReduced } from "@/lib/design/motion";

const easeOut = [0.33, 1, 0.68, 1] as [number, number, number, number];
const HAIRLINE = "1px solid rgba(15,23,42,0.06)";

export function RequestBrief() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [reducedMotion, setReducedMotion] = useState(true);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setReducedMotion(
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      );
    }
  }, []);

  const variants = reducedMotion ? fadeUpReduced : fadeUp;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  }

  return (
    <section
      id="request-brief"
      ref={ref}
      style={{
        position: "relative",
        backgroundColor: "var(--surface-3, #F2F4F7)",
        borderTop: `${HAIRLINE}`,
      }}
    >
      {/* Axis continuation */}
      <div
        className="gov-axis hidden lg:block"
        style={{ left: "72px" }}
        aria-hidden
      />

      <div
        className="arch-container relative"
        style={{ paddingTop: "112px", paddingBottom: "112px" }}
      >
        <div
          className="arch-grid"
          style={{ alignItems: "center", rowGap: "48px" }}
        >
          {/* Left — statement */}
          <div className="arch-col-6">
            <motion.div
              variants={variants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ duration: 0.65, ease: easeOut }}
            >
              <p
                className="gov-kicker"
                style={{ marginBottom: "20px" }}
              >
                Executive Brief
              </p>
              <h2
                style={{
                  fontSize: "clamp(1.625rem, 3.2vw, 2.625rem)",
                  fontWeight: 800,
                  lineHeight: 1.06,
                  letterSpacing: "-0.025em",
                  color: "var(--text, #0F172A)",
                  margin: "0 0 18px",
                }}
              >
                Request Executive Brief
              </h2>
              <p
                style={{
                  fontSize: "0.9375rem",
                  color: "var(--text-2, #475569)",
                  lineHeight: 1.65,
                  maxWidth: "400px",
                }}
              >
                A 2-page overview of the legitimacy model and command layer.
              </p>
            </motion.div>
          </div>

          {/* Right — form panel */}
          <div className="arch-col-6">
            <motion.div
              variants={variants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
              transition={{ duration: 0.7, ease: easeOut, delay: 0.1 }}
            >
              {submitted ? (
                <div
                  className="gov-panel"
                  style={{ padding: "32px 36px" }}
                >
                  <p
                    className="gov-kicker"
                    style={{ marginBottom: "12px" }}
                  >
                    Request received
                  </p>
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      color: "var(--text, #0F172A)",
                      margin: 0,
                      lineHeight: 1.55,
                    }}
                  >
                    We will send the brief to{" "}
                    <strong style={{ fontWeight: 600 }}>{email}</strong> within
                    48 hours.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmit}
                  className="gov-panel gov-panel--elevated"
                >
                  <div style={{ padding: "28px 32px 24px", borderBottom: HAIRLINE }}>
                    <label
                      htmlFor="brief-email"
                      className="gov-kicker"
                      style={{
                        display: "block",
                        fontSize: "10px",
                        letterSpacing: "0.2em",
                        marginBottom: "10px",
                      }}
                    >
                      Work email
                    </label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        id="brief-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="login-input"
                        style={{ flex: 1 }}
                      />
                      <button
                        type="submit"
                        style={{
                          flexShrink: 0,
                          padding: "10px 22px",
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          letterSpacing: "0.01em",
                          color: "#fff",
                          backgroundColor: "var(--color-accent, #1E40AF)",
                          border: "none",
                          borderRadius: "3px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          transition: "opacity 0.18s ease",
                        }}
                        onMouseOver={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.opacity = "0.88")
                        }
                        onMouseOut={(e) =>
                          ((e.currentTarget as HTMLButtonElement).style.opacity = "1")
                        }
                      >
                        Send Brief
                      </button>
                    </div>
                  </div>
                  <div style={{ padding: "14px 32px" }}>
                    <p
                      className="gov-kicker"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.14em",
                      }}
                    >
                      For executives and compliance leads. No marketing.
                    </p>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
