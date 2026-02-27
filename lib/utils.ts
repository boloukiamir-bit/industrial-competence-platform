import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Safe for redirect: only paths under /app/ to prevent open-redirect. */
export function isSafeAppReturnTo(path: string | null | undefined): path is string {
  return typeof path === "string" && path.startsWith("/app/");
}
