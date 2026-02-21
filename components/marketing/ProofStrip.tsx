const items = [
  {
    kicker: "Audit Trail",
    title: "Decision trail that stands up to audit",
    line: "Every override is attributable — who, when, why.",
  },
  {
    kicker: "Deterministic",
    title: "Validation is reproducible",
    line: "Same inputs. Same outcome. No heuristic drift.",
  },
  {
    kicker: "Legitimacy",
    title: "Computed execution legitimacy",
    line: "GO / WARNING / NO-GO with an evidence chain.",
  },
  {
    kicker: "Sectors",
    title: "Built for high-stakes domains",
    line: "Industry, energy, pharma, medical, government.",
  },
] as const;

const HAIRLINE = "1px solid var(--hairline-soft, rgba(15,23,42,0.06))";

export function ProofStrip() {
  return (
    <section
      style={{
        backgroundColor: "var(--surface-3, #F2F4F7)",
        borderTop: HAIRLINE,
        borderBottom: HAIRLINE,
      }}
    >
      <div
        className="arch-container"
        style={{ paddingTop: "48px", paddingBottom: "48px" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 0,
          }}
          className="proof-strip-grid"
        >
          {items.map((item, i) => (
            <div
              key={item.kicker}
              style={{
                padding: "0 28px",
                borderRight:
                  i < items.length - 1 ? HAIRLINE : "none",
              }}
              className="proof-strip-item"
            >
              <p
                className="gov-kicker"
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.22em",
                  marginBottom: "10px",
                }}
              >
                {item.kicker}
              </p>
              <p
                style={{
                  fontSize: "1rem",
                  fontWeight: 700,
                  lineHeight: 1.3,
                  letterSpacing: "-0.01em",
                  color: "var(--text, #0F172A)",
                  margin: "0 0 8px",
                }}
              >
                {item.title}
              </p>
              <p
                style={{
                  fontSize: "0.8125rem",
                  lineHeight: 1.55,
                  color: "var(--text-3, #94A3B8)",
                  margin: 0,
                }}
              >
                {item.line}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
