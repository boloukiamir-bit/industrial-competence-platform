"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/coreFetch";
import { normalizeShift } from "@/lib/shift";

const defaultDate = () => new Date().toISOString().slice(0, 10);
const DEFAULT_SHIFT_OPTIONS = ["Day", "Evening", "Night"];

function normalizeShiftCode(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (/^s[1-3]$/i.test(raw)) return raw.toUpperCase();
  const canonical = normalizeShift(raw);
  return canonical ?? raw;
}

function pickShiftOption(current: string, options: string[]): string {
  if (options.length === 0) return current;
  const normalized = normalizeShiftCode(current) ?? current;
  const exact = options.find((opt) => opt === normalized);
  if (exact) return exact;
  const caseInsensitive = options.find((opt) => opt.toLowerCase() === normalized.toLowerCase());
  return caseInsensitive ?? options[0];
}

const CockpitFilterContext = createContext<{
  date: string;
  shiftType: string;
  shiftOptions: string[];
  line: string;
  setDate: (d: string) => void;
  setShiftType: (s: string) => void;
  setLine: (l: string) => void;
} | null>(null);

export function CockpitFilterProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [date, setDate] = useState<string>(defaultDate);
  const [shiftType, setShiftType] = useState<string>("Day");
  const [line, setLine] = useState<string>("all");
  const [shiftOptions, setShiftOptions] = useState<string[]>(DEFAULT_SHIFT_OPTIONS);
  const urlSyncedRef = useRef(false);

  // URL sync: read date, shift_code/shift, line from URL on mount
  useEffect(() => {
    if (urlSyncedRef.current) return;
    const qDate = searchParams.get("date")?.trim();
    const qShift = searchParams.get("shift_code")?.trim() || searchParams.get("shift")?.trim();
    const qLine = searchParams.get("line")?.trim();
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) setDate(qDate);
    const normalizedShift = normalizeShiftCode(qShift);
    if (normalizedShift) setShiftType(normalizedShift);
    if (qLine != null) setLine(qLine === "" || qLine === "all" ? "all" : qLine);
    urlSyncedRef.current = true;
  }, [searchParams]);

  // URL sync: push date, shift_code, line to URL when they change
  useEffect(() => {
    if (!urlSyncedRef.current) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("date", date);
    p.set("shift_code", shiftType);
    p.delete("shift");
    p.set("line", line);
    const next = p.toString();
    const current = searchParams.toString();
    if (next !== current) router.replace(`/app/cockpit?${next}`, { scroll: false });
  }, [date, shiftType, line, router, searchParams]);

  // Load shift options from /api/cockpit/shift-codes?date= (tenant-scoped, stable for date)
  useEffect(() => {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    let cancelled = false;
    fetchJson<{ ok: true; shift_codes: string[] }>(`/api/cockpit/shift-codes?date=${encodeURIComponent(date)}`)
      .then((res) => {
        if (cancelled || !res.ok) return;
        const list = res.data?.shift_codes ?? [];
        const unique = list.length > 0 ? Array.from(new Set(list)) : DEFAULT_SHIFT_OPTIONS;
        setShiftOptions(unique);
        setShiftType((prev) => pickShiftOption(prev, unique));
      })
      .catch(() => {
        if (cancelled) return;
        setShiftOptions(DEFAULT_SHIFT_OPTIONS);
        setShiftType((prev) => pickShiftOption(prev, DEFAULT_SHIFT_OPTIONS));
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const handleShiftTypeChange = (value: string) => {
    const normalized = normalizeShiftCode(value);
    setShiftType(normalized ?? value);
  };

  return (
    <CockpitFilterContext.Provider
      value={{ date, shiftType, shiftOptions, line, setDate, setShiftType: handleShiftTypeChange, setLine }}
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
