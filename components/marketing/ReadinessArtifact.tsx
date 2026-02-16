"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { WarmSection } from "./WarmSection";
import { SceneManagerReadiness } from "./editorial-sketches/scenes";
import { Reveal, RevealStagger, fadeUp } from "./motion";

/*
  INTERACTION RULES (deterministic, no backend):
  - Baseline: readiness 94%, dueActions 2, 3 baseline audit rows.
  - Expired certificate ON: readiness -9, dueActions +2, append "Cert expired — action created".
  - Missing station skill ON: readiness -14, dueActions +1, append "Skill gap detected — coverage reduced".
  - Supervisor override ON: +6 readiness ONLY when at least one of (expired cert, missing skill) is ON;
    otherwise no change and show "No issue to override". When applicable: append "Override approved — reason logged" (or with reason if provided).
  - Audit log: max 5 rows, newest on top. New rows fade/slide in.
*/

const BASELINE_READINESS = 94;
const BASELINE_DUE_ACTIONS = 2;

const BASELINE_AUDIT_ROWS = [
  { id: "b1", time: "09:02", text: "Station coverage recalculated" },
  { id: "b2", time: "08:58", text: "Skills sync completed" },
  { id: "b3", time: "08:45", text: "Baseline snapshot" },
];

function useAnimatedNumber(target: number, durationMs: number, enabled: boolean) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const startValue = value;
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const easeOut = 1 - (1 - t) * (1 - t);
      setValue(Math.round(startValue + (target - startValue) * easeOut));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, durationMs, enabled]);
  return value;
}

type AuditRow = { id: string; time: string; text: string };

export function ReadinessArtifact() {
  const reduced = useReducedMotion();
  const [expiredCert, setExpiredCert] = useState(false);
  const [missingSkill, setMissingSkill] = useState(false);
  const [supervisorOverride, setSupervisorOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [auditRows, setAuditRows] = useState<AuditRow[]>(BASELINE_AUDIT_ROWS);
  const prevExpired = useRef(false);
  const prevSkill = useRef(false);
  const prevOverride = useRef(false);

  const overrideApplies = supervisorOverride && (expiredCert || missingSkill);

  const readiness = Math.min(
    100,
    Math.max(
      0,
      BASELINE_READINESS -
        (expiredCert ? 9 : 0) -
        (missingSkill ? 14 : 0) +
        (overrideApplies ? 6 : 0)
    )
  );
  const dueActions =
    BASELINE_DUE_ACTIONS +
    (expiredCert ? 2 : 0) +
    (missingSkill ? 1 : 0);

  const displayReadiness = useAnimatedNumber(readiness, 750, !reduced);

  const appendAuditRow = useCallback((time: string, text: string) => {
    setAuditRows((prev) => {
      const next = [{ id: `audit-${Date.now()}`, time, text }, ...prev];
      return next.slice(0, 5);
    });
  }, []);

  useEffect(() => {
    if (expiredCert && !prevExpired.current) {
      appendAuditRow("09:04", "Cert expired — action created");
    }
    prevExpired.current = expiredCert;
  }, [expiredCert, appendAuditRow]);

  useEffect(() => {
    if (missingSkill && !prevSkill.current) {
      appendAuditRow("09:03", "Skill gap detected — coverage reduced");
    }
    prevSkill.current = missingSkill;
  }, [missingSkill, appendAuditRow]);

  useEffect(() => {
    if (overrideApplies && !prevOverride.current) {
      const reasonText =
        overrideReason.trim().length > 0
          ? `Override approved — reason: ${overrideReason.trim().slice(0, 40)}${overrideReason.trim().length > 40 ? "…" : ""}`
          : "Override approved — reason logged";
      appendAuditRow("09:05", reasonText);
    }
    prevOverride.current = supervisorOverride;
  }, [overrideApplies, supervisorOverride, overrideReason, appendAuditRow]);

  // When user types override reason after enabling, update the override audit row text
  useEffect(() => {
    if (!overrideApplies || overrideReason.trim().length === 0) return;
    const reasonText = `Override approved — reason: ${overrideReason.trim().slice(0, 40)}${overrideReason.trim().length > 40 ? "…" : ""}`;
    setAuditRows((prev) =>
      prev.map((r) =>
        r.text.startsWith("Override approved")
          ? { ...r, text: reasonText }
          : r
      )
    );
  }, [overrideApplies, overrideReason]);

  const bullets = [
    "Skills and compliance roll up to station coverage",
    "Overrides require a reason and are logged",
    "Every change is traceable in the audit log",
  ];

  return (
    <WarmSection dotGrid className="border-t border-black/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Faint editorial scene accent (opacity 0.12–0.18) */}
        <div
          className="absolute top-1/2 left-4 -translate-y-1/2 w-36 h-24 opacity-[0.15] text-foreground pointer-events-none hidden lg:block"
          aria-hidden
        >
          <SceneManagerReadiness className="w-full h-full" />
        </div>

        <div className="grid lg:grid-cols-[1fr,1fr] gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <div className="relative">
            <Reveal>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Readiness simulator
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-3 font-display text-2xl md:text-3xl font-normal tracking-tight text-foreground">
                See what changes readiness — instantly.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-4 text-muted-foreground max-w-lg">
                Toggle common events. BCLEDGE updates readiness and logs every
                decision for audit review.
              </p>
            </Reveal>
            <RevealStagger className="mt-6 space-y-3">
              {bullets.map((text, i) => (
                <motion.li
                  key={text}
                  variants={fadeUp}
                  className="flex gap-2 text-sm text-foreground"
                >
                  <span className="text-[#1e3a5f] shrink-0">—</span>
                  <span>{text}</span>
                </motion.li>
              ))}
            </RevealStagger>
          </div>

          {/* Right: toggles + artifact panel (on mobile: toggles first, then panel) */}
          <div className="flex flex-col gap-6">
            {/* Toggles: real buttons, keyboard accessible */}
            <Reveal delay={0.1}>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Simulator toggles">
                <button
                  type="button"
                  onClick={() => setExpiredCert((p) => !p)}
                  aria-pressed={expiredCert}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    expiredCert
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "bg-white border-black/10 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  }`}
                >
                  Expired certificate
                </button>
                <button
                  type="button"
                  onClick={() => setMissingSkill((p) => !p)}
                  aria-pressed={missingSkill}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    missingSkill
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "bg-white border-black/10 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  }`}
                >
                  Missing station skill
                </button>
                <button
                  type="button"
                  onClick={() => setSupervisorOverride((p) => !p)}
                  aria-pressed={supervisorOverride}
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    supervisorOverride
                      ? "bg-[#1e3a5f] text-white border-[#1e3a5f]"
                      : "bg-white border-black/10 text-muted-foreground hover:bg-black/5 hover:text-foreground"
                  }`}
                >
                  Supervisor override
                </button>
              </div>
              {supervisorOverride && !overrideApplies && (
                <p className="mt-2 text-xs text-muted-foreground italic">
                  No issue to override
                </p>
              )}
              {overrideApplies && (
                <div className="mt-3">
                  <label htmlFor="readiness-override-reason" className="sr-only">
                    Reason for override
                  </label>
                  <input
                    id="readiness-override-reason"
                    type="text"
                    placeholder="Reason: ____"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    className="w-full max-w-xs rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Override reason (optional)"
                  />
                </div>
              )}
            </Reveal>

            {/* Artifact panel: fixed aspect to avoid CLS */}
            <Reveal delay={0.15}>
              <div
                className="rounded-2xl bg-white border border-black/5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08)] overflow-hidden"
                style={{ aspectRatio: "4/3" }}
              >
                <div className="h-full flex flex-col p-5 md:p-6">
                  {/* Score row */}
                  <div className="flex items-start justify-between gap-4 flex-shrink-0">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Readiness
                      </p>
                      <p className="mt-0.5 text-3xl md:text-4xl font-display font-normal tabular-nums text-foreground">
                        {displayReadiness}%
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        vs baseline 0
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#f7f5f2] border border-black/5 px-3 py-1.5 flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Due actions
                      </span>
                      <span className="font-display font-semibold tabular-nums text-foreground">
                        {dueActions}
                      </span>
                    </div>
                  </div>

                  {/* Audit log */}
                  <div className="mt-4 flex-1 min-h-0 flex flex-col">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex-shrink-0">
                      Audit log
                    </p>
                    <ul className="space-y-1.5 overflow-auto flex-shrink min-h-0" aria-label="Recent audit entries">
                      {auditRows.map((row) => (
                        <motion.li
                          key={row.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reduced ? 0 : 0.35,
                            ease: [0.25, 0.4, 0.25, 1],
                          }}
                          className="text-xs text-foreground flex gap-2 flex-shrink-0"
                        >
                          <span className="tabular-nums text-muted-foreground shrink-0">
                            {row.time}
                          </span>
                          <span className="truncate">{row.text}</span>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </WarmSection>
  );
}
