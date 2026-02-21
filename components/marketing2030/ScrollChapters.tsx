"use client";

import { useRef, useState, useEffect } from "react";

const CHAPTER_IDS = [
  "chapter-hero",
  "chapter-global-gap",
  "chapter-governance-stack",
  "chapter-command-preview",
  "chapter-mic-drop",
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function onScroll() {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const p = docHeight <= 0 ? 0 : Math.min(1, scrollTop / docHeight);
        setProgress(p);
        rafRef.current = null;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return progress;
}

export function useActiveChapter(): ChapterId | null {
  const [active, setActive] = useState<ChapterId | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.id as ChapterId;
          if (CHAPTER_IDS.includes(id)) setActive(id);
        }
      },
      { rootMargin: "-30% 0px -50% 0px", threshold: 0 }
    );

    CHAPTER_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observerRef.current?.observe(el);
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return active;
}

interface ScrollChaptersProps {
  progress: number;
  activeChapter: ChapterId | null;
}

export function ScrollChapters({ progress }: ScrollChaptersProps) {
  return (
    <div
      className="fixed left-0 top-0 z-10 h-0.5 bg-accent/30 transition-opacity duration-300"
      style={{ width: `${progress * 100}%` }}
      aria-hidden
    />
  );
}

export { CHAPTER_IDS };
