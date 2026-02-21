"use client";

import { ChapterShell } from "./ChapterShell";

interface Metric {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}

const metrics: Metric[] = [
  { label: "Legitimacy", value: "GO", unit: "", accent: true },
  { label: "Decision Trail", value: "Enabled", unit: "" },
  { label: "Time to readiness check", value: "< 5", unit: "min" },
];

const logRows = [
  { time: "08:42", action: "Compliance check", outcome: "VERIFIED", go: true },
  { time: "08:47", action: "Override request",  outcome: "DENIED",   go: false },
  { time: "08:51", action: "Period approval",    outcome: "GO",        go: true },
] as const;

const HAIRLINE = "1px solid rgba(15,23,42,0.06)";

const leftContent = (
  <div style={{ display: "flex", flexDirection: "column" }}>
    {metrics.map((m, i) => (
      <div
        key={m.label}
        style={{
          paddingTop: i === 0 ? 0 : "28px",
          paddingBottom: "28px",
          borderBottom: i < metrics.length - 1 ? HAIRLINE : "none",
        }}
      >
        <p
          className="gov-kicker"
          style={{ fontSize: "10px", letterSpacing: "0.2em", marginBottom: "8px" }}
        >
          {m.label}
        </p>
        <p
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: 1.0,
            color: m.accent ? "var(--go, #15803D)" : "var(--text, #0F172A)",
            margin: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {m.value}
          {m.unit && (
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 400,
                marginLeft: "8px",
                color: "var(--text-3, #94A3B8)",
                letterSpacing: 0,
              }}
            >
              {m.unit}
            </span>
          )}
        </p>
      </div>
    ))}
  </div>
);

const rightContent = (
  <div className="gov-panel gov-panel--elevated">
    {/* Log header */}
    <div
      style={{
        padding: "13px 22px",
        borderBottom: HAIRLINE,
      }}
    >
      <p
        className="gov-kicker"
        style={{ fontSize: "10px", letterSpacing: "0.18em" }}
      >
        Decision Log — Period 06:00–14:00
      </p>
    </div>

    {/* Column headers */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "72px 1fr 80px",
        padding: "10px 22px",
        borderBottom: HAIRLINE,
        gap: "16px",
      }}
    >
      {(["Time", "Action", "Outcome"] as const).map((h) => (
        <span
          key={h}
          className="gov-kicker"
          style={{ fontSize: "10px", letterSpacing: "0.16em" }}
        >
          {h}
        </span>
      ))}
    </div>

    {/* Log rows */}
    {logRows.map((row, i) => (
      <div
        key={i}
        style={{
          display: "grid",
          gridTemplateColumns: "72px 1fr 80px",
          padding: "15px 22px",
          borderBottom: i < logRows.length - 1 ? HAIRLINE : "none",
          gap: "16px",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "0.8125rem",
            fontVariantNumeric: "tabular-nums",
            color: "var(--text-3, #94A3B8)",
            letterSpacing: "0.02em",
          }}
        >
          {row.time}
        </span>
        <span
          style={{
            fontSize: "0.875rem",
            color: "var(--text, #0F172A)",
            letterSpacing: "-0.005em",
          }}
        >
          {row.action}
        </span>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: row.go ? "var(--go, #15803D)" : "var(--nog, #B91C1C)",
          }}
        >
          {row.outcome}
        </span>
      </div>
    ))}
  </div>
);

export function Chapter03Proof() {
  return (
    <ChapterShell
      id="chapter-output"
      label="The Output"
      title={
        <>
          <span style={{ display: "block" }}>A command layer</span>
          <span style={{ display: "block" }}>that stands up</span>
          <span style={{ display: "block" }}>to audit.</span>
        </>
      }
      subtitle="Every decision logged. Every override accountable."
      left={leftContent}
      right={rightContent}
      bg="bg"
    />
  );
}
