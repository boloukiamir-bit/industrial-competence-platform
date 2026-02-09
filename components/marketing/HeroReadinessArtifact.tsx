export function HeroReadinessArtifact() {
  return (
    <div
      className="w-full rounded-xl overflow-hidden p-8 md:p-10 lg:p-12"
      aria-hidden="true"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-10 md:gap-16">
        {/* One large Readiness number */}
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span className="text-6xl sm:text-7xl md:text-8xl font-semibold tabular-nums tracking-[-0.04em] text-foreground">
              94
            </span>
            <span className="text-2xl sm:text-3xl font-medium text-muted-foreground">%</span>
          </div>
          <p className="mt-2 text-xs uppercase tracking-widest text-muted-foreground/80">
            Readiness
          </p>
        </div>

        {/* One short audit log excerpt */}
        <div className="flex-1 min-w-0 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-10">
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10">
                08:42
              </span>
              <p className="text-sm text-foreground">
                Forklift cert expiring — 12 days. <span className="text-muted-foreground font-mono text-xs">evt-2841</span>
              </p>
            </div>
            <div className="flex gap-4">
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10">
                08:31
              </span>
              <p className="text-sm text-foreground">
                Annual check overdue — Line A. <span className="text-muted-foreground font-mono text-xs">evt-2840</span>
              </p>
            </div>
            <div className="flex gap-4">
              <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10">
                07:15
              </span>
              <p className="text-sm text-foreground">
                Station X — 1 unqualified. <span className="text-muted-foreground font-mono text-xs">evt-2839</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
