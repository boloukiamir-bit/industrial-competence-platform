import Link from "next/link";

const company = [
  { label: "Product", href: "#product" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
];

const legal = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

export function MarketingFooter() {
  return (
    <footer
      className="bg-[#f7f5f2] border-t border-black/5 py-16 md:py-20"
      role="contentinfo"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-12">
          <div>
            <Link
              href="/"
              className="font-semibold text-foreground text-lg tracking-tight hover:opacity-80 transition-opacity"
            >
              BCLEDGE
            </Link>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs">
              The system of record for industrial competence and compliance.
            </p>
          </div>
          <nav className="flex flex-wrap gap-12 md:gap-16" aria-label="Footer">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Company
              </p>
              <ul className="space-y-2">
                {company.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Legal
              </p>
              <ul className="space-y-2">
                {legal.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Contact
              </p>
              <a
                href="mailto:hello@bcledge.com"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                hello@bcledge.com
              </a>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                Security
              </p>
              <a
                href="#security"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Security & trust
              </a>
            </div>
          </nav>
        </div>
        <div className="mt-14 pt-8 border-t border-black/5">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} BCLEDGE. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
