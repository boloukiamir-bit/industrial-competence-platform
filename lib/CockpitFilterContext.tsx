"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/** Prefer date from URL (searchParams); otherwise today. No hardcoded day (e.g. 13). */
function defaultDate(): string {
  if (typeof window === "undefined") return new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams(window.location.search);
  const d = params.get("date")?.trim();
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

const CockpitFilterContext = createContext<{
  date: string;
  shiftType: string;
  line: string;
  setDate: (d: string) => void;
  setShiftType: (s: string) => void;
  setLine: (l: string) => void;
} | null>(null);

export function CockpitFilterProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string>(defaultDate);
  const [shiftType, setShiftType] = useState<string>("Day");
  const [line, setLine] = useState<string>("all");

  return (
    <CockpitFilterContext.Provider
      value={{ date, shiftType, line, setDate, setShiftType, setLine }}
    >
      {children}
    </CockpitFilterContext.Provider>
  );
}

export function useCockpitFilters() {
  const ctx = useContext(CockpitFilterContext);
  if (!ctx) throw new Error("useCockpitFilters must be used within CockpitFilterProvider");
  return ctx;
}
