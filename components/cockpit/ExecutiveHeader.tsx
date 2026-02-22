"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ExecutiveHeaderProps = {
  userName?: string | null;
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
  const greeting = name ? `Welcome, ${name}` : "Welcome";

  return (
    <header
      className={cn("mt-2 mb-6 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4", className)}
      data-testid="executive-header"
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
          {greeting}
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-2)" }}>
          Here is your operational readiness overview.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="h-8 px-2 rounded-md border border-[var(--hairline)] bg-white text-[var(--text)] text-sm"
          data-testid="input-date"
        />
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
