import { cn } from "@/lib/utils";

type WarmSectionProps = {
  children: React.ReactNode;
  className?: string;
  /** If true, adds very subtle dot grid texture */
  dotGrid?: boolean;
  /** 'warm' = cream, 'white' = white content area feel */
  variant?: "warm" | "white";
};

export function WarmSection({
  children,
  className,
  dotGrid = false,
  variant = "warm",
}: WarmSectionProps) {
  return (
    <section
      className={cn(
        "py-16 md:py-24 lg:py-28",
        variant === "warm" && "warm-bg",
        variant === "white" && "bg-white",
        dotGrid && "warm-dot-grid",
        className
      )}
    >
      {children}
    </section>
  );
}
