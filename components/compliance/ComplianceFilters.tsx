"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type CategoryTab = "all" | "license" | "medical" | "contract";

const CATEGORY_TABS: Array<{ value: CategoryTab; label: string }> = [
  { value: "all", label: "All" },
  { value: "license", label: "Licenses" },
  { value: "medical", label: "Medical" },
  { value: "contract", label: "Contract" },
];

type ComplianceFiltersProps = {
  search: string;
  onSearchChange: (v: string) => void;
  category: CategoryTab;
  onCategoryChange: (v: CategoryTab) => void;
  lineFilter: string;
  onLineFilterChange: (v: string) => void;
  lines: string[];
  actionRequiredOnly: boolean;
  onActionRequiredOnlyChange: (v: boolean) => void;
};

export function ComplianceFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  lineFilter,
  onLineFilterChange,
  lines,
  actionRequiredOnly,
  onActionRequiredOnlyChange,
}: ComplianceFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search employee name or #"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div
          role="tablist"
          className="inline-flex rounded-md border bg-muted/30 p-0.5"
        >
          {CATEGORY_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={category === value}
              onClick={() => onCategoryChange(value)}
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                category === value
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {lines.length > 0 && (
          <select
            value={lineFilter}
            onChange={(e) => onLineFilterChange(e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All lines</option>
            {lines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        )}
        <Button
          variant={actionRequiredOnly ? "secondary" : "ghost"}
          size="sm"
          className="h-9"
          onClick={() => onActionRequiredOnlyChange(!actionRequiredOnly)}
        >
          {actionRequiredOnly ? "Action required only" : "Show all"}
        </Button>
      </div>
    </div>
  );
}
