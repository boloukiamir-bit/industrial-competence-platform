"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/services/auth";
import { Loader2 } from "lucide-react";
import { LoginShell2030 } from "@/components/auth/LoginShell2030";

const POLL_MS = 800;
const TIMEOUT_MS = 18_000;

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"waiting" | "expired">("waiting");

  useEffect(() => {
    let cancelled = false;
    const start = Date.now();

    async function checkSession() {
      if (cancelled) return;
      try {
        const session = await getSession();
        if (session?.user && session?.access_token && session?.refresh_token) {
          await fetch("/api/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
            credentials: "include",
          });
          router.replace("/app/cockpit");
          return;
        }
      } catch {
        // ignore
      }
      if (Date.now() - start >= TIMEOUT_MS) {
        setStatus("expired");
        return;
      }
      setTimeout(checkSession, POLL_MS);
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "expired") {
    return (
      <LoginShell2030>
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-sm" style={{ color: "var(--text, #0F172A)" }}>
            Link expired
          </p>
          <p className="text-sm" style={{ color: "var(--text-3, #94A3B8)" }}>
            The sign-in link has expired or was already used. Request a new one from the login page.
          </p>
          <Link
            href="/login"
            className="py-2.5 px-4 text-sm font-medium text-white rounded"
            style={{ backgroundColor: "var(--color-accent, #1E40AF)" }}
          >
            Back to login
          </Link>
        </div>
      </LoginShell2030>
    );
  }

  return (
    <LoginShell2030>
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-sm">Finishing sign-in…</p>
      </div>
    </LoginShell2030>
  );
}
