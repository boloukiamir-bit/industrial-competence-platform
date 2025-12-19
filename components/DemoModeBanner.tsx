"use client";

import { Shield, ExternalLink } from "lucide-react";
import Link from "next/link";
import { isDemoMode } from "@/lib/demoRuntime";

export function DemoModeBanner() {
  const demoEnabled = isDemoMode();

  if (!demoEnabled) return null;

  return (
    <div 
      className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2"
      data-testid="banner-demo-mode"
    >
      <div className="flex items-center justify-center gap-3 text-sm">
        <Shield className="h-4 w-4" />
        <span className="font-medium">Demo Mode Active</span>
        <span className="opacity-80">Viewing pre-configured demo data</span>
        <span className="opacity-50">|</span>
        <Link 
          href="/app/demo-center" 
          className="flex items-center gap-1 underline hover:no-underline"
          data-testid="link-demo-center"
        >
          <ExternalLink className="h-3 w-3" />
          Demo Center
        </Link>
      </div>
    </div>
  );
}
