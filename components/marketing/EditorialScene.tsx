"use client";

import { SketchWrapper } from "./motion";

type EditorialSceneProps = {
  children: React.ReactNode;
  /** Aspect ratio for reserved space (no CLS). e.g. "4/3" | "3/2" | "16/10" */
  aspectRatio?: string;
  className?: string;
  /** Paper panel + grain. Default true. */
  withPanel?: boolean;
  /** Fade + parallax + 1–2px drift. Disabled when prefers-reduced-motion. */
  withMotion?: boolean;
  once?: boolean;
  amount?: number;
};

export function EditorialScene({
  children,
  aspectRatio = "4/3",
  className = "",
  withPanel = true,
  withMotion = true,
  once = true,
  amount = 0.12,
}: EditorialSceneProps) {
  const content = (
    <div
      className={`relative overflow-hidden rounded-2xl ${withPanel ? "editorial-scene-panel" : ""} ${className}`}
      style={{ aspectRatio }}
    >
      <div className="absolute inset-0 flex items-center justify-center p-4 text-foreground [&>svg]:max-h-full [&>svg]:w-auto [&>svg]:object-contain">
        {children}
      </div>
      {withPanel && (
        <div className="editorial-scene-grain pointer-events-none absolute inset-0 rounded-2xl" aria-hidden />
      )}
    </div>
  );

  if (withMotion) {
    return (
      <SketchWrapper parallax once={once} amount={amount} className="w-full">
        {content}
      </SketchWrapper>
    );
  }

  return content;
}
