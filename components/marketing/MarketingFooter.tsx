import Link from "next/link";

const navLinks = [
  { label: "Problem",       href: "#chapter-gap",    external: false },
  { label: "Model",         href: "#chapter-model",  external: false },
  { label: "Command",       href: "#chapter-output", external: false },
  { label: "Request Brief", href: "#request-brief",  external: false },
  { label: "Login",         href: "/login",           external: true  },
] as const;

const legal = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms",   href: "/terms"   },
] as const;

const KICKER: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  color: "var(--text-3, #94A3B8)",
  marginBottom: "14px",
  display: "block",
};

const LINK: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "var(--text-2, #475569)",
  textDecoration: "none",
  display: "block",
  lineHeight: 1,
};

export function MarketingFooter() {
  return (
    <footer
      role="contentinfo"
      style={{
        backgroundColor: "var(--surface, #FFFFFF)",
        borderTop: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))",
      }}
    >
      <div
        className="arch-container"
        style={{ paddingTop: "72px", paddingBottom: "40px" }}
      >
        {/* Top row */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "48px",
          }}
          className="md:flex-row md:justify-between md:items-start"
        >
          {/* Brand block */}
          <div style={{ maxWidth: "280px" }}>
            <Link
              href="/"
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text, #0F172A)",
                textDecoration: "none",
              }}
            >
              BCLEDGE
            </Link>
            <p
              style={{
                marginTop: "10px",
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "var(--text-3, #94A3B8)",
              }}
            >
              Governance infrastructure for execution legitimacy.
            </p>
          </div>

          {/* Link groups */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "48px",
            }}
          >
            {/* Platform navigation */}
            <div>
              <span style={KICKER}>Platform</span>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {navLinks.map((link) =>
                  link.external ? (
                    <li key={link.label}>
                      <Link href={link.href} style={LINK}>
                        {link.label}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.label}>
                      <a href={link.href} style={LINK}>
                        {link.label}
                      </a>
                    </li>
                  )
                )}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <span style={KICKER}>Legal</span>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {legal.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} style={LINK}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <span style={KICKER}>Contact</span>
              <a
                href="mailto:hello@bcledge.com"
                style={LINK}
              >
                hello@bcledge.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom rule */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "24px",
            borderTop: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--text-3, #94A3B8)",
              margin: 0,
            }}
          >
            © {new Date().getFullYear()} BCLEDGE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
