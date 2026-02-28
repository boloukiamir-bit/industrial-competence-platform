"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "/pricing" },
  { label: "Request Brief", href: "#request-brief" },
] as const;

export function HeroNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center bg-white border-b border-slate-200/60"
        aria-label="Main navigation"
      >
        <div className="w-full max-w-6xl mx-auto px-5 sm:px-8 lg:px-12 h-full flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 flex-shrink-0 no-underline"
            aria-label="BCLEDGE home"
          >
            <Image
              src="/bcledge-logo.png"
              alt=""
              width={26}
              height={26}
              className="object-contain"
              priority
            />
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              BCLEDGE
            </span>
          </Link>

          <nav
            className="hidden md:flex items-center gap-7"
            aria-label="Main"
          >
            {NAV_LINKS.map((item) =>
              item.href.startsWith("#") ? (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden md:flex items-center gap-5">
            <Button asChild size="default" className="rounded-md font-medium">
              <Link href="#book-demo">Book Demo</Link>
            </Button>
            <Link
              href="/login"
              className="text-[13px] font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Login
            </Link>
          </div>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-slate-700"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 pt-16 bg-white border-t border-slate-200/60"
          aria-hidden
        >
          <nav
            className="max-w-6xl mx-auto px-5 py-8 flex flex-col gap-0"
            aria-label="Mobile main"
          >
            {NAV_LINKS.map((item, i) => (
              <div
                key={item.label}
                className={i < NAV_LINKS.length - 1 ? "border-b border-slate-100" : ""}
              >
                {item.href.startsWith("#") ? (
                  <a
                    href={item.href}
                    onClick={closeMobile}
                    className="block py-4 text-base font-medium text-slate-900"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    onClick={closeMobile}
                    className="block py-4 text-base font-medium text-slate-900"
                  >
                    {item.label}
                  </Link>
                )}
              </div>
            ))}
            <div className="flex flex-col gap-3 mt-6">
              <Button asChild className="rounded-lg w-full">
                <Link href="#book-demo" onClick={closeMobile}>
                  Book Demo
                </Link>
              </Button>
              <Link
                href="/login"
                onClick={closeMobile}
                className="block py-2 text-center text-sm font-medium text-slate-600"
              >
                Login
              </Link>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
