"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const reducedMotionConfig = { duration: 0, delay: 0 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (reduced: boolean) =>
    reduced
      ? { opacity: 1, y: 0, transition: reducedMotionConfig }
      : { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] } },
};

export const staggerChildren: Variants = {
  visible: (reduced: boolean) => ({
    transition: reduced
      ? { staggerChildren: 0, delayChildren: 0 }
      : { staggerChildren: 0.08, delayChildren: 0.1 },
  }),
};

export const float: Variants = {
  initial: { y: 0 },
  animate: (reduced: boolean) =>
    reduced
      ? {}
      : {
          y: [0, -6, 0],
          transition: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        },
};

export const parallaxLite: Variants = {
  hidden: { opacity: 0.6, y: 8 },
  visible: (reduced: boolean) =>
    reduced
      ? { opacity: 1, y: 0, transition: reducedMotionConfig }
      : { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.4, 0.25, 1] } },
};

/** For editorial sketches: fade in + very slight vertical drift (1–2px). No bounce. */
export const sketchFadeDrift: Variants = {
  hidden: { opacity: 0, y: 4 },
  visible: (reduced: boolean) =>
    reduced
      ? { opacity: 1, y: 0, transition: reducedMotionConfig }
      : { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.4, 0.25, 1] } },
};

export const hoverLift = {
  rest: { y: 0, transition: { duration: 0.2 } },
  hover: (reduced: boolean) =>
    reduced ? {} : { y: -2, transition: { duration: 0.2 } },
};

export const tapPress = {
  scale: 1,
  tap: (reduced: boolean) => (reduced ? {} : { scale: 0.98 }),
};

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  once?: boolean;
  amount?: number;
};

export function Reveal({ children, className, delay = 0, once = true, amount = 0.15 }: RevealProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={fadeUp}
      custom={reduced}
      transition={reduced ? undefined : { delay }}
    >
      {children}
    </motion.div>
  );
}

type RevealStaggerProps = {
  children: React.ReactNode;
  className?: string;
  once?: boolean;
  amount?: number;
};

export function RevealStagger({ children, className, once = true, amount = 0.1 }: RevealStaggerProps) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={staggerChildren}
      custom={reduced}
    >
      {children}
    </motion.div>
  );
}

export function useMotionConfig() {
  const reduced = useReducedMotion();
  return { reduced: !!reduced, reducedMotionConfig };
}

type SketchWrapperProps = {
  children: React.ReactNode;
  className?: string;
  /** Use parallax-on-scroll feel (subtle). Disabled when prefers-reduced-motion. */
  parallax?: boolean;
  once?: boolean;
  amount?: number;
};

export function SketchWrapper({
  children,
  className,
  parallax = true,
  once = true,
  amount = 0.1,
}: SketchWrapperProps) {
  const reduced = useReducedMotion();
  const variants = parallax ? parallaxLite : sketchFadeDrift;
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants}
      custom={reduced}
    >
      {children}
    </motion.div>
  );
}

export { motion };
