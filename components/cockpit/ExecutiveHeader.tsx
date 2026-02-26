"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type CockpitMode = "global" | "shift";

export type ExecutiveHeaderProps = {
  userName?: string | null;
  mode: CockpitMode;
  onModeChange: (mode: CockpitMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  shiftCode: string;
  onShiftCodeChange: (code: string) => void;
  availableShiftCodes: string[];
  shiftCodesError?: string | null;
  line: string;
  onLineChange: (line: string) => void;
  lineOptions: string[];
  showResolved?: boolean;
  onShowResolvedChange?: (value: boolean) => void;
  className?: string;
};

export function ExecutiveHeader({
  userName,
  mode,
  onModeChange,
  date,
  onDateChange,
  shiftCode,
  onShiftCodeChange,
  availableShiftCodes,
  shiftCodesError,
  line,
  onLineChange,
  lineOptions,
  showResolved = false,
  onShowResolvedChange,
  className,
}: ExecutiveHeaderProps) {
  const name = (userName ?? "").trim();
  const greeting = name ? `Hi, ${name}` : "Cockpit";
  const isShift = mode === "shift";

  return (
    <header
      className={cn("mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4", className)}
      data-testid="executive-header"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          {greeting}
        </h1>
        <p className="text-sm mt-1 text-muted-foreground" style={{ color: "var(--text-2)" }}>
          Operational readiness overview.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-[var(--hairline)] overflow-hidden">
          <button
            type="button"
            onClick={() => onModeChange("global")}
            className={cn(
              "h-8 px-3 text-[13px] font-medium transition-colors",
              mode === "global"
                ? "bg-[var(--text)] text-white"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            )}
            data-testid="cockpit-mode-global"
          >
            GLOBAL
          </button>
          <button
            type="button"
            onClick={() => onModeChange("shift")}
            className={cn(
              "h-8 px-3 text-[13px] font-medium border-l border-[var(--hairline)] transition-colors",
              mode === "shift"
                ? "bg-[var(--text)] text-white"
                : "bg-[var(--surface)] text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            )}
            data-testid="cockpit-mode-shift"
          >
            SHIFT
          </button>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 px-2 rounded-md border border-[var(--hairline)] bg-white text-[var(--text)] text-sm"
          data-testid="input-date"
        />
        {isShift && (
          <>
            <Select value={shiftCode || undefined} onValueChange={onShiftCodeChange} disabled={availableShiftCodes.length === 0}>
              <SelectTrigger className="h-8 w-[110px] px-2 text-[13px] border-[var(--hairline)] bg-white" data-testid="select-shift">
                <SelectValue placeholder="Shift" />
              </SelectTrigger>
              <SelectContent>
                {availableShiftCodes.length > 0 ? (
                  availableShiftCodes.map((code) => (
                    <SelectItem key={code} value={code}>{code}</SelectItem>
                  ))
                ) : (
                  <SelectItem value="__no_shift_codes" disabled>No shifts</SelectItem>
                )}
              </SelectContent>
            </Select>
            {shiftCodesError ? (
              <span className="text-[11px] text-red-600" data-testid="shift-codes-error">{shiftCodesError}</span>
            ) : null}
          </>
        )}
        <Select value={line} onValueChange={onLineChange}>
          <SelectTrigger className="h-8 w-[110px] px-2 text-[13px] border-[var(--hairline)] bg-white" data-testid="select-line">
            <SelectValue placeholder="Line" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lines</SelectItem>
            {lineOptions.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onShowResolvedChange != null && (
          <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-1" style={{ color: "var(--text-2)" }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => onShowResolvedChange(e.target.checked)}
              className="rounded border-[var(--hairline)]"
              data-testid="cockpit-show-resolved"
            />
            Show resolved
          </label>
        )}
      </div>
    </header>
  );
}
