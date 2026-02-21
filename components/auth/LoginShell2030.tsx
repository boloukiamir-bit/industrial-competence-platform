"use client";

export function LoginShell2030({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="2030"
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg, #F4F6F8)", color: "var(--text, #0F172A)" }}
    >
      <div className="arch-container min-h-screen">
        <div
          className="min-h-screen"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1px 1fr",
            gap: 0,
          }}
        >
          {/* Left — statement */}
          <div
            className="flex flex-col justify-center"
            style={{ paddingRight: "64px", paddingTop: "72px" }}
          >
            <h1
              style={{
                fontSize: "clamp(2rem, 4vw, 3.25rem)",
                fontWeight: 700,
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                color: "var(--text, #0F172A)",
              }}
            >
              <span className="block">Access Governance</span>
              <span className="block">Infrastructure.</span>
            </h1>
            <div className="mt-8" style={{ maxWidth: "520px" }}>
              <p
                className="text-base"
                style={{ color: "var(--text-2, #475569)", lineHeight: 1.6 }}
              >
                Industrial legitimacy is validated.
              </p>
              <p
                className="mt-2 text-base"
                style={{ color: "var(--text-2, #475569)", lineHeight: 1.6 }}
              >
                Every decision is accountable.
              </p>
            </div>
            <p className="mt-12">
              <a
                href="/"
                className="text-sm hover:underline"
                style={{ color: "var(--color-accent, #1E40AF)" }}
              >
                Back to overview
              </a>
            </p>
          </div>

          {/* Vertical separator */}
          <div
            style={{ backgroundColor: "var(--border, #E5EAF0)" }}
            aria-hidden
          />

          {/* Right — form */}
          <div
            className="flex flex-col justify-center"
            style={{ paddingLeft: "64px", paddingTop: "72px" }}
          >
            <div
              className="w-full flex flex-col"
              style={{
                maxWidth: "420px",
                backgroundColor: "var(--surface, #FFFFFF)",
                border: "1px solid var(--border, #E5EAF0)",
                borderRadius: "4px",
                boxShadow: "0 2px 20px rgba(15,23,42,0.04)",
                padding: "40px",
                gap: "28px",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: collapse to single column */}
      <style>{`
        @media (max-width: 768px) {
          .arch-container > [style*="grid-template-columns"] {
            display: flex !important;
            flex-direction: column !important;
          }
          .arch-container > [style*="grid-template-columns"] > div:nth-child(2) {
            display: none !important;
          }
          .arch-container > [style*="grid-template-columns"] > div:first-child {
            padding-right: 0 !important;
            padding-top: 96px !important;
            padding-bottom: 32px !important;
            min-height: auto !important;
          }
          .arch-container > [style*="grid-template-columns"] > div:last-child {
            padding-left: 0 !important;
            padding-top: 0 !important;
            padding-bottom: 48px !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
