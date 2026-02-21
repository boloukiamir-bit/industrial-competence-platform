"use client";

import { ChapterShell } from "./ChapterShell";

const rows = [
  {
    assumption: "We think we're compliant",
    evidence: "We can prove legitimacy",
  },
  {
    assumption: "Decisions in chat",
    evidence: "Decisions in an audit trail",
  },
  {
    assumption: "After-the-fact reconstruction",
    evidence: "Deterministic validation",
  },
] as const;

const HAIRLINE = "1px solid rgba(15,23,42,0.06)";

const artifact = (
  <div className="gov-panel gov-panel--elevated">
    {/* Column headers */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        borderBottom: HAIRLINE,
      }}
    >
      <div
        style={{
          padding: "13px 22px",
          borderRight: HAIRLINE,
        }}
      >
        <span
          className="gov-kicker"
          style={{ fontSize: "10px", letterSpacing: "0.2em" }}
        >
          Assumption
        </span>
      </div>
      <div style={{ padding: "13px 22px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.2em",
            color: "var(--color-accent, #1E40AF)",
          }}
        >
          Evidence
        </span>
      </div>
    </div>

    {/* Data rows */}
    {rows.map((row, i) => (
      <div
        key={i}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          borderBottom: i < rows.length - 1 ? HAIRLINE : "none",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderRight: HAIRLINE,
            fontSize: "0.875rem",
            color: "var(--text-3, #94A3B8)",
            lineHeight: 1.55,
          }}
        >
          {row.assumption}
        </div>
        <div
          style={{
            padding: "18px 22px",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "var(--text, #0F172A)",
            lineHeight: 1.55,
          }}
        >
          {row.evidence}
        </div>
      </div>
    ))}
  </div>
);

export function Chapter01Gap() {
  return (
    <ChapterShell
      id="chapter-gap"
      label="The Gap"
      title={
        <>
          <span style={{ display: "block" }}>Execution runs</span>
          <span style={{ display: "block" }}>on assumption.</span>
        </>
      }
      subtitle="Regulators and audits run on evidence."
      left={null}
      right={artifact}
      bg="bg"
    />
  );
}
