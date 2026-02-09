import { FactoryOutline } from "./illustrations";

export function HeroProductCollage() {
  return (
    <div className="relative w-full max-w-md mx-auto lg:max-w-lg aspect-[4/3] flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center opacity-[0.12] text-foreground pointer-events-none">
        <FactoryOutline className="w-[70%] h-auto max-h-[60%]" />
      </div>
      <div className="relative w-full flex flex-col items-center gap-4">
        <div
          className="w-[85%] max-w-[280px] rounded-2xl bg-white p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08),0_8px_24px_-8px_rgba(0,0,0,0.06)] border border-black/5"
          style={{ transform: "rotate(-1deg)" }}
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Readiness</p>
          <p className="mt-1 text-4xl font-display font-normal tabular-nums text-foreground">94%</p>
          <p className="mt-2 text-xs text-muted-foreground">vs last week +2</p>
        </div>
        <div
          className="w-[80%] max-w-[260px] -mt-2 rounded-2xl bg-white p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.08),0_8px_24px_-8px_rgba(0,0,0,0.06)] border border-black/5 ml-8"
          style={{ transform: "rotate(1.5deg)" }}
        >
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Audit log</p>
          <div className="space-y-1.5 text-xs">
            <p className="text-foreground">08:42 — Cert expiring, 12 days</p>
            <p className="text-muted-foreground">08:31 — Medical overdue, Line A</p>
            <p className="text-muted-foreground">07:15 — Station X, 1 gap</p>
          </div>
        </div>
        <div
          className="absolute -bottom-2 -right-2 lg:right-4 rounded-xl bg-white px-4 py-2 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.08)] border border-black/5"
          style={{ transform: "rotate(-2deg)" }}
        >
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Due</p>
          <p className="text-sm font-medium text-foreground">2 actions</p>
        </div>
      </div>
    </div>
  );
}
