"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";

export function isDemoMode(): boolean {
  if (typeof window !== "undefined") {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("demo") === "true") return true;
  }
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

export function DemoModeBanner() {
  const demoEnabled = isDemoMode();

  if (!demoEnabled) return null;

  return (
    <div 
      className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2"
      data-testid="banner-demo-mode"
    >
      <div className="flex items-center justify-center gap-2 text-sm text-amber-800 dark:text-amber-200">
        <AlertCircle className="h-4 w-4" />
        <span>Demo Mode: using sample data</span>
        <span className="text-amber-600 dark:text-amber-400">|</span>
        <Link 
          href="/app/demo" 
          className="underline hover:no-underline"
          data-testid="link-demo-script"
        >
          View Demo Script
        </Link>
      </div>
    </div>
  );
}
