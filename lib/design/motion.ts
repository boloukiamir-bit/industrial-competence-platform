/**
 * Motion presets for /2030 and synced login.
 * Respects prefers-reduced-motion: no floats, simple fades only.
 */

import type { Variants, Transition } from "framer-motion";

const easeOut = [0.33, 1, 0.68, 1] as const;
const easeInOut = [0.65, 0, 0.35, 1] as const;

const baseTransition: Transition = { duration: 0.7, ease: easeOut };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};
export const fadeUpTransition: Transition = { duration: 0.7, ease: easeOut };

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
export const fadeInTransition: Transition = { duration: 0.8, ease: easeOut };

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  visible: { opacity: 1, scale: 1 },
};
export const scaleInTransition: Transition = { duration: 0.6, ease: easeOut };

/** Use only when reduced motion is not preferred */
export const slowFloatTransition = {
  y: [0, -6, 0],
  duration: 12,
  ease: easeInOut,
  repeat: Infinity,
} as const;

/** Use only when reduced motion is not preferred */
export const subtleGlowPulseTransition = {
  opacity: [1, 0.92, 1],
  duration: 5,
  ease: easeInOut,
  repeat: Infinity,
} as const;

/** Default transition for list stagger */
export const staggerTransition: Transition = {
  staggerChildren: 0.08,
  delayChildren: 0.05,
};

/** Check reduced motion (client-safe: defaults to true to be safe on SSR) */
export function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Variants that respect reduced motion: no y movement, shorter duration */
export const fadeUpReduced: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeInReducedTransition: Transition = { duration: 0.4, ease: easeOut };

/** Slow vertical drift for atmospheric ghost elements (skip when reduced motion) */
export const slowDriftY = {
  y: { duration: 14, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" as const },
};

/** Micro scale pulse for status indicators (skip when reduced motion) */
export const microPulse = {
  scale: { duration: 2.4, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" as const },
};
