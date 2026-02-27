import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe for redirect: only paths under /app/ to prevent open-redirect. */
export function isSafeAppReturnTo(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/app/");
}

/** Normalize date string for dirty check: YYYY-MM-DD or "". */
export function normDate(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  const t = s.trim().slice(0, 10);
  return t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}
