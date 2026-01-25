"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const defaultDate = () => new Date().toISOString().slice(0, 10);

const CockpitFilterContext = createContext<{
  date: string;
  shiftType: "Day" | "Evening" | "Night";
  line: string;
  setDate: (d: string) => void;
  setShiftType: (s: "Day" | "Evening" | "Night") => void;
  setLine: (l: string) => void;
} | null>(null);

export function CockpitFilterProvider({ children }: { children: ReactNode }) {
  const [date, setDate] = useState<string>(defaultDate);
  const [shiftType, setShiftType] = useState<"Day" | "Evening" | "Night">("Day");
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
