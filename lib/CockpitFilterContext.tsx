"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

function getStockholmToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = { year: "", month: "", day: "" };
  for (const part of parts) {
    if (part.type === "year" || part.type === "month" || part.type === "day") {
      map[part.type] = part.value;
    }
  }
  return `${map.year}-${map.month}-${map.day}`;
}

/** Prefer date from URL (searchParams); otherwise today (Europe/Stockholm). */
export function getInitialDateFromUrlOrToday(searchParams?: URLSearchParams): string {
  const params =
    searchParams ??
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null);
  const d = params?.get("date")?.trim();
  if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return getStockholmToday();
}

/** Backwards-compatible export. */
export const getInitialCockpitDate = getInitialDateFromUrlOrToday;

const CockpitFilterContext = createContext<{
  date: string;
  shiftType: string;
  line: string;
  setDate: (d: string) => void;
  setShiftType: (s: string) => void;
  setLine: (l: string) => void;
} | null>(null);

export function CockpitFilterProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string>(() => getInitialDateFromUrlOrToday());
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
