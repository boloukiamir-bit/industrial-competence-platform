"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const NAV_ANCHORS = [
  { label: "Problem",       href: "#chapter-gap"    },
  { label: "Model",         href: "#chapter-model"  },
  { label: "Command",       href: "#chapter-output" },
  { label: "Request Brief", href: "#request-brief"  },
] as const;

const LINK_STYLE: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  letterSpacing: "0.01em",
  color: "var(--text-2, #475569)",
  textDecoration: "none",
  paddingBottom: "2px",
  borderBottom: "1px solid transparent",
  transition: "color 0.15s ease, border-color 0.15s ease",
};

const LINK_HOVER_STYLE: React.CSSProperties = {
  color: "var(--text, #0F172A)",
  borderBottom: "1px solid var(--hairline, rgba(15,23,42,0.10))",
};

function NavLink({
  href,
  children,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const isAnchor = href.startsWith("#");
  const [hovered, setHovered] = useState(false);

  const combinedStyle = {
    ...LINK_STYLE,
    ...(hovered ? LINK_HOVER_STYLE : {}),
  };

  if (isAnchor) {
    return (
      <a
        href={href}
        style={combinedStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      style={combinedStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          height: "72px",
          backgroundColor: "var(--bg, #F4F6F8)",
          borderBottom: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))",
        }}
        aria-label="Main navigation"
      >
        <div className="arch-container h-full flex items-center justify-between">

          {/* Logo + wordmark */}
          <Link
            href="/"
            className="flex items-center gap-2.5 flex-shrink-0"
            style={{ textDecoration: "none" }}
            aria-label="BCLEDGE home"
          >
            <Image
              src="/bcledge-logo.png"
              alt="BCLedge"
              width={28}
              height={28}
              style={{ objectFit: "contain" }}
              priority
            />
            <span
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text, #0F172A)",
              }}
            >
              BCLEDGE
            </span>
          </Link>

          {/* Desktop nav — center anchors */}
          <nav
            className="hidden md:flex items-center"
            style={{ gap: "32px" }}
            aria-label="Main"
          >
            {NAV_ANCHORS.map((item) => (
              <NavLink key={item.label} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop — Login */}
          <div className="hidden md:flex">
            <NavLink href="/login">Login</NavLink>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 -mr-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen
              ? <X className="h-5 w-5" style={{ color: "var(--text, #0F172A)" }} />
              : <Menu className="h-5 w-5" style={{ color: "var(--text, #0F172A)" }} />
            }
          </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{
            paddingTop: "72px",
            backgroundColor: "var(--bg, #F4F6F8)",
            borderTop: "1px solid var(--hairline-soft, rgba(15,23,42,0.06))",
          }}
        >
          <nav
            className="arch-container flex flex-col"
            style={{ paddingTop: "32px", gap: "0" }}
            aria-label="Mobile main"
          >
            {NAV_ANCHORS.map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                onClick={closeMobile}
                style={{
                  padding: "16px 0",
                  fontSize: "1rem",
                  fontWeight: 500,
                  color: "var(--text, #0F172A)",
                  textDecoration: "none",
                  borderBottom: i < NAV_ANCHORS.length - 1
                    ? "1px solid var(--hairline-soft, rgba(15,23,42,0.06))"
                    : "none",
                  display: "block",
                }}
              >
                {item.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={closeMobile}
              style={{
                padding: "16px 0",
                fontSize: "1rem",
                fontWeight: 500,
                color: "var(--text-2, #475569)",
                textDecoration: "none",
                display: "block",
                marginTop: "8px",
              }}
            >
              Login
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
