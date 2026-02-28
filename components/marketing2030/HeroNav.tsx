"use client";

import Link from "next/link";

const NAV_ITEMS = [
  { label: "Problem", href: "/2030#chapter-global-gap" },
  { label: "Governance Model", href: "/2030#chapter-governance-stack" },
  { label: "Command Layer", href: "/2030#chapter-command-preview" },
  { label: "Risk Surface", href: "/2030#chapter-command-preview" },
  { label: "Executive Brief", href: "/2030#request-brief" },
] as const;

export function HeroNav() {
  return (
    <header
      className="fixed left-0 right-0 top-0 z-20 border-b bg-white/95 backdrop-blur-sm"
      style={{ borderColor: "#E5E7EB" }}
      aria-label="Primary navigation"
    >
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-8" aria-label="Institutional">
          {NAV_ITEMS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className="text-sm font-medium transition-colors hover:text-[#0B1220]"
              style={{ color: "#6B7280" }}
            >
              {label}
            </Link>
          ))}
        </nav>
        <Link
          href="/login"
          className="text-sm font-medium transition-colors hover:text-[#0B1220]"
          style={{ color: "#6B7280" }}
        >
          Login
        </Link>
      </div>
    </header>
  );
}
