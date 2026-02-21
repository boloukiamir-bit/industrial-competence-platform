"use client";

import Link from "next/link";
import { useSessionHealth } from "@/lib/SessionHealthContext";
import { Button } from "@/components/ui/button";

const LOGIN_PATH = "/login";

/**
 * Renders a single deterministic banner when session is invalid.
 * When has_session is false: "Session expired" + CTA to /login.
 * When has_session is true: nothing (cockpit is operational).
 */
export function OperationalReadinessBanner() {
  const { hasSession, loading } = useSessionHealth();

  if (loading || hasSession === true) return null;

  return (
    <div
      className="gov-panel px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-l-4"
      style={{
        borderLeftColor: "hsl(var(--destructive))",
        background: "color-mix(in srgb, hsl(var(--destructive)) 8%, var(--surface, #fff))",
      }}
      data-testid="cockpit-session-expired-banner"
    >
      <div>
        <p className="font-medium" style={{ color: "var(--text)" }}>Session expired</p>
        <p className="text-sm mt-0.5" style={{ color: "var(--text-2)" }}>Your sign-in session ended. Sign in to continue.</p>
      </div>
      <Button asChild variant="default" size="sm" className="h-8 text-sm">
        <Link href={LOGIN_PATH} data-testid="cockpit-session-expired-cta">
          Sign in
        </Link>
      </Button>
    </div>
  );
}
