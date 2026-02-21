/**
 * Design foundation — Light Corporate Premium (2030)
 * Tokens and helpers for /2030 and synced login. Do not use for cockpit/app.
 */

export const tokens = {
  bg: "#F4F6F8",
  surface: "#FFFFFF",
  surface2: "#F9FAFB",
  text: "#0F172A",
  text2: "#475569",
  text3: "#94A3B8",
  border: "#E5EAF0",
  accent: "#1E40AF",
  go: "#15803D",
  warn: "#B45309",
  nog: "#B91C1C",
  illegal: "#7F1D1D",
} as const;

export type TokenKey = keyof typeof tokens;

/** CSS variable names (without --) for use in style or className */
export const cssVarNames = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  text: "var(--text)",
  text2: "var(--text-2)",
  text3: "var(--text-3)",
  border: "var(--border)",
  accent: "var(--accent)",
  go: "var(--go)",
  warn: "var(--warn)",
  nog: "var(--nog)",
  illegal: "var(--illegal)",
} as const;

/** Tailwind-compatible arbitrary value for background */
export function bgToken(key: TokenKey): string {
  return tokens[key];
}

/** Tailwind-compatible arbitrary value for text color */
export function textToken(key: TokenKey): string {
  return tokens[key];
}

export const theme2030Attribute = "data-theme" as const;
export const theme2030Value = "2030" as const;
