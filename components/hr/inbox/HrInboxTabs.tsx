"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export type InboxTab = "actions" | "lifecycle" | "governance" | "contract" | "medical";
export type ActionsFilter = "open" | "overdue" | "due7" | "all";

const TABS: { value: InboxTab; label: string }[] = [
  { value: "actions", label: "Actions" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "governance", label: "Governance" },
  { value: "contract", label: "Contract" },
  { value: "medical", label: "Medical" },
];

const ACTION_FILTERS: { value: ActionsFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "due7", label: "Due ≤ 7" },
  { value: "all", label: "All" },
];

export type HrInboxTabsProps = {
  tab: InboxTab;
  filter: ActionsFilter;
  onTabChange?: (tab: InboxTab) => void;
  onFilterChange?: (filter: ActionsFilter) => void;
};

export function HrInboxTabs({ tab, filter }: HrInboxTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setTab(newTab: InboxTab) {
    const next = new URLSearchParams(searchParams);
    next.set("tab", newTab);
    if (newTab !== "actions") next.delete("filter");
    router.push(`/app/hr/inbox?${next.toString()}`);
  }

  function setFilter(newFilter: ActionsFilter) {
    const next = new URLSearchParams(searchParams);
    next.set("filter", newFilter);
    router.push(`/app/hr/inbox?${next.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              tab === t.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "actions" && (
        <div className="flex flex-wrap items-center gap-2">
          {ACTION_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                filter === f.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
