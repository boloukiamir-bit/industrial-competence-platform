"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, Package, BarChart3 } from "lucide-react";

const HR_CHECKLIST_KEY = "onboarding-hr-checklist";

type HrCheckItem = {
  id: string;
  label: string;
  description: string;
  href: string;
};

const HR_ITEMS: HrCheckItem[] = [
  {
    id: "employees",
    label: "Add or import employees",
    description: "Register your team so compliance and assignments are tracked.",
    href: "/app/employees",
  },
  {
    id: "compliance",
    label: "Review compliance overview",
    description: "See licenses, medical checks, and contracts — validity and triage.",
    href: "/app/compliance",
  },
  {
    id: "actions",
    label: "Use Action Inbox for due items",
    description: "Handle expiring and overdue compliance items in one place.",
    href: "/app/compliance/actions",
  },
  {
    id: "digest",
    label: "Send or check Weekly Digest",
    description: "Share a summary with managers or use it for your own follow-up.",
    href: "/app/compliance/digest",
  },
  {
    id: "templates",
    label: "Configure templates and action packs",
    description: "Define compliance types and reusable packs for common roles.",
    href: "/app/hr/templates",
  },
];

function loadChecklistState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HR_CHECKLIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    }
  } catch {
    // ignore
  }
  return {};
}

function saveChecklistState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(HR_CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export default function OnboardingPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setChecked(loadChecklistState());
  }, []);

  const handleToggle = (id: string, value: boolean) => {
    const next = { ...checked, [id]: value };
    setChecked(next);
    saveChecklistState(next);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Pilot onboarding</h1>
        <p className="text-sm text-muted-foreground">
          Get started with the platform — no training required.
        </p>
      </header>

      {/* Section A: HR/Admin checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">HR / Admin checklist</CardTitle>
          <CardDescription>
            Work through these to set up and run compliance and HR workflows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {HR_ITEMS.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <Checkbox
                id={item.id}
                checked={!!checked[item.id]}
                onCheckedChange={(v) => handleToggle(item.id, v === true)}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0 space-y-1">
                <label
                  htmlFor={item.id}
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  {item.label}
                </label>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <Button variant="ghost" size="sm" className="h-auto p-0 text-primary" asChild>
                  <Link href={item.href}>
                    Open {item.label.toLowerCase().split(" ")[0]} →
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Section B: Manager quick start */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Manager quick start</CardTitle>
          <CardDescription>
            Managers have read-only access to compliance and digests for their team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You can view compliance status for your reports, open the weekly digest, and browse action packs. No edits — use these to follow up with HR or your team.
          </p>
          <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
            Read-only: managers cannot create or change compliance records, templates, or action packs.
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/compliance">
                <BarChart3 className="h-4 w-4 mr-1.5" />
                Compliance
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/compliance/digest">
                <ClipboardCheck className="h-4 w-4 mr-1.5" />
                Weekly Digest
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/hr/templates/action-packs">
                <Package className="h-4 w-4 mr-1.5" />
                Action Packs
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
