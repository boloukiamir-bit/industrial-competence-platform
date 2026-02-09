"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const mainNavItems = [
  { label: "Product", href: "#product" },
  { label: "Use Cases", href: "#use-cases" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#resources" },
];

const stickyNavIds = ["product", "use-cases", "security", "pricing"];

export function MarketingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setStickyVisible(window.scrollY > 320);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id;
          if (stickyNavIds.includes(id)) setActiveId(id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
    );
    stickyNavIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [stickyVisible]);

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-black/5"
        aria-label="Main navigation"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:grid md:grid-cols-3 md:gap-4">
            <Link
              href="/"
              className="font-semibold text-foreground text-lg tracking-tight hover:opacity-80 transition-opacity"
              aria-label="BCLEDGE home"
            >
              BCLEDGE
            </Link>

            <nav className="hidden md:flex items-center justify-center gap-1" aria-label="Main">
              {mainNavItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium text-muted-foreground rounded-lg transition-colors",
                    "hover:text-foreground hover:bg-black/[0.04]"
                  )}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" className="marketing-accent border-0 rounded-xl" asChild>
                <Link href="#book-demo">Book a demo</Link>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden col-start-3 justify-self-end"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {stickyVisible && (
          <div className="hidden md:block border-t border-black/5 bg-white/95 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4">
              <nav className="flex items-center justify-center gap-1 h-12" aria-label="Section navigation">
                {stickyNavIds.map((id) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={cn(
                      "px-3 py-2 text-xs font-medium rounded-lg transition-colors",
                      activeId === id
                        ? "text-foreground bg-black/[0.06]"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {id === "use-cases" ? "Use Cases" : id.charAt(0).toUpperCase() + id.slice(1)}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        )}
      </header>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 pt-16 bg-white border-t border-black/5">
          <nav className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-1" aria-label="Main mobile">
            {mainNavItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="px-4 py-3 text-sm font-medium text-foreground rounded-xl hover:bg-[#f7f5f2]"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-6 mt-4 border-t border-black/5">
              <Button variant="outline" className="w-full rounded-xl" asChild>
                <Link href="/login" onClick={() => setMobileOpen(false)}>Login</Link>
              </Button>
              <Button className="w-full marketing-accent border-0 rounded-xl" asChild>
                <Link href="#book-demo" onClick={() => setMobileOpen(false)}>Book a demo</Link>
              </Button>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
