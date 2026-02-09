import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const previewCards = [
  { title: "Readiness Index", value: "94%", status: "On track", variant: "ok" as const },
  { title: "Compliance Exposure", value: "2", status: "Actions due", variant: "warn" as const },
  { title: "Shift Coverage", value: "Tomorrow", status: "3 gaps", variant: "warn" as const },
  { title: "Audit Log", value: "—", status: "Decision log", variant: "neutral" as const },
];

const statusStyles = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  warn: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function ProductPreview() {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card shadow-sm overflow-hidden",
        "w-full max-w-[360px] mx-auto lg:max-w-none"
      )}
      aria-hidden="true"
    >
      <div className="px-4 pt-3 pb-2 border-b border-border">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Product preview
        </p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {previewCards.map((card) => (
          <Card key={card.title} className="border border-border shadow-none bg-muted/30">
            <CardHeader className="p-3 pb-1">
              <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <p className="text-lg font-semibold tabular-nums text-foreground">{card.value}</p>
              <Badge
                variant="outline"
                className={cn("mt-1.5 text-[10px] font-medium", statusStyles[card.variant])}
              >
                {card.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
