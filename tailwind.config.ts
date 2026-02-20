import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: ".5625rem",
        md: ".375rem",
        sm: ".1875rem",
      },
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        go: "var(--color-go)",
        warning: "var(--color-warning)",
        illegal: "var(--color-illegal)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
          border: "var(--color-border)",
        },
        popover: {
          DEFAULT: "var(--color-surface)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
          border: "var(--color-border)",
        },
        primary: {
          DEFAULT: "var(--color-accent)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
          border: "var(--color-accent)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
          border: "hsl(var(--secondary) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "var(--color-muted)",
          border: "var(--color-border)",
        },
        accent: {
          DEFAULT: "var(--color-accent)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
          border: "var(--color-accent)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
          border: "var(--destructive-border)",
        },
        ring: "var(--color-accent)",
        chart: {
          "1": "hsl(var(--chart-1) / <alpha-value>)",
          "2": "hsl(var(--chart-2) / <alpha-value>)",
          "3": "hsl(var(--chart-3) / <alpha-value>)",
          "4": "hsl(var(--chart-4) / <alpha-value>)",
          "5": "hsl(var(--chart-5) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)", "var(--font-serif)"],
      },
    },
  },
  plugins: [],
} satisfies Config;
