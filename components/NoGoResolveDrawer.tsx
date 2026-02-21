"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { logExecutionDecision } from "@/lib/executionDecisions";
import type { RootCausePayload, RootCauseType } from "@/types/cockpit";
import { AlertCircle, Check, ExternalLink, Loader2, Stethoscope, Shield, Database, Repeat } from "lucide-react";

type NoGoResolveDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftAssignmentId?: string | null;
  stationName?: string;
  employeeName?: string | null;
  onResolved?: (status: "created" | "already_resolved") => void;
  /** Cockpit filter: date (YYYY-MM-DD) for Line Overview deep-link */
  cockpitDate?: string;
  /** Cockpit filter: shift type for Line Overview deep-link */
  cockpitShift?: "Day" | "Evening" | "Night";
  /** Cockpit filter: line; use "all" or omit when no line filter */
  cockpitLine?: string;
};

const typeConfig: Record<RootCauseType, { label: string; color: string; icon: JSX.Element }> = {
  competence: {
    label: "Competence",
    color: "bg-blue-100 text-blue-800",
    icon: <Repeat className="h-4 w-4" />,
  },
  cert: {
    label: "Certification",
    color: "bg-amber-100 text-amber-800",
    icon: <Shield className="h-4 w-4" />,
  },
  medical: {
    label: "Medical",
    color: "bg-red-100 text-red-800",
    icon: <Stethoscope className="h-4 w-4" />,
  },
  data: {
    label: "Data",
    color: "bg-slate-100 text-slate-800",
    icon: <Database className="h-4 w-4" />,
  },
};

const actions: Array<"swap" | "assign" | "call_in" | "escalate" | "fix_data"> = [
  "swap",
  "assign",
  "call_in",
  "escalate",
  "fix_data",
];

function defaultSelectedActions(type: RootCauseType): string[] {
  if (type === "competence") return ["swap"];
  if (type === "cert" || type === "medical") return ["assign"];
  return ["fix_data"];
}

const formatActionLabel = (action: string) => action.replace("_", " ");

function ActionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-muted text-muted-foreground border-transparent hover:border-input"
      }`}
    >
      {label}
    </button>
  );
}

export function NoGoResolveDrawer({
  open,
  onOpenChange,
  shiftAssignmentId,
  stationName,
  employeeName,
  onResolved,
  cockpitDate,
  cockpitShift,
  cockpitLine,
}: NoGoResolveDrawerProps) {
  const router = useRouter();
  const [rootCause, setRootCause] = useState<RootCausePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"created" | "already_resolved" | null>(null);

  const formattedStation = stationName || "Station";
  const formattedEmployee = employeeName || "Unassigned";

  const recommendedActions = useMemo(() => rootCause?.recommended_actions ?? [], [rootCause]);

  useEffect(() => {
    if (!open) {
      setStatus(null);
      return;
    }

    if (!shiftAssignmentId) {
      setRootCause(null);
      setError("Missing shift assignment");
      return;
    }

    async function loadRootCause() {
      setLoading(true);
      setError(null);
      setRootCause(null);
      setSelectedActions([]);
      try {
        const response = await fetch("/api/cockpit/root-cause", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shift_assignment_id: shiftAssignmentId }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Failed to fetch root cause");
        }

        const data = await response.json();
        const payload = data.root_cause as RootCausePayload | undefined;
        if (payload) {
          setRootCause(payload);
          setSelectedActions(defaultSelectedActions(payload.type));
        } else {
          setRootCause({
            type: "data",
            message: "Root cause not yet classified",
            blocking: true,
            details: { station_id: shiftAssignmentId ?? "", station_name: formattedStation, employee_id: null },
            missing: [],
            recommended_actions: ["fix_data", "escalate"],
          });
          setSelectedActions(defaultSelectedActions("data"));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch root cause");
      } finally {
        setLoading(false);
      }
    }

    loadRootCause();
  }, [open, shiftAssignmentId, formattedStation]);

  const toggleAction = (action: string) => {
    setSelectedActions((prev) =>
      prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
    );
  };

  const handleResolve = async () => {
    if (!shiftAssignmentId || !rootCause) return;
    setSaving(true);
    setStatus(null);
    try {
      const result = await logExecutionDecision({
        decision_type: "resolve_no_go",
        target_type: "shift_assignment",
        target_id: shiftAssignmentId,
        reason: note || null,
        root_cause: rootCause,
        actions: {
          recommended: rootCause.recommended_actions,
          selected: selectedActions,
          note: note || null,
        },
      });

      setStatus(result.status);
      onResolved?.(result.status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setSaving(false);
    }
  };

  const currentType = rootCause?.type ?? "data";
  const typeMeta = typeConfig[currentType];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Resolve NO-GO</SheetTitle>
          <SheetDescription>
            {formattedStation} • {formattedEmployee}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Root cause</p>
            <div className="flex items-center gap-2">
              <Badge className={typeMeta.color}>
                <span className="mr-1">{typeMeta.icon}</span>
                {typeMeta.label}
              </Badge>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              {status === "already_resolved" && (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" />
                  Already resolved
                </Badge>
              )}
            </div>
            {error ? (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>{error}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {rootCause?.type === "competence" && rootCause?.competence_root_cause
                  ? "Missing required skills"
                  : rootCause?.message ?? "Root cause not yet classified"}
              </p>
            )}
          </div>

          {rootCause?.type === "competence" && rootCause?.competence_root_cause && (
            <div className="rounded-md border p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Required skills</p>
              <ul className="space-y-1">
                {(rootCause.competence_root_cause.requiredSkills?.length
                  ? rootCause.competence_root_cause.requiredSkills
                  : rootCause.competence_root_cause.requiredSkillCodes?.map((code) => ({
                      code,
                      name: code,
                    })) ?? []
                ).map((s, idx) => (
                  <li key={`${s.code}-${idx}`} className="text-sm">
                    <span className="font-medium">{s.code}</span>
                    {s.name !== s.code && (
                      <span className="text-muted-foreground"> — {s.name}</span>
                    )}
                  </li>
                ))}
              </ul>
              {rootCause.competence_root_cause.eligibleOperators?.length > 0 && (
                <>
                  <p className="text-xs font-semibold text-muted-foreground pt-1">
                    Eligible operators (meet line requirements)
                  </p>
                  {rootCause.competence_root_cause.stationsRequired != null &&
                    rootCause.competence_root_cause.stationsRequired > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Line has {rootCause.competence_root_cause.stationsRequired} station
                        requirement(s)
                        {rootCause.competence_root_cause.requiredSkillCodes?.length != null &&
                          rootCause.competence_root_cause.requiredSkillCodes.length > 0 && (
                            <> and {rootCause.competence_root_cause.requiredSkillCodes.length} unique skill(s)</>
                          )}
                        .
                      </p>
                    )}
                  <ul className="space-y-1">
                    {rootCause.competence_root_cause.eligibleOperators.map((op, idx) => (
                      <li key={`${op.employee_number}-${idx}`} className="text-sm">
                        <span className="font-medium">{op.employee_number}</span>
                        {op.name && (
                          <span className="text-muted-foreground"> — {op.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (cockpitDate) params.set("date", cockpitDate);
                      if (cockpitShift) params.set("shift", cockpitShift);
                      if (cockpitLine && cockpitLine !== "all") params.set("line", cockpitLine);
                      const sid = rootCause?.details?.station_id?.trim();
                      if (sid) params.set("station_id", sid);
                      if (shiftAssignmentId) params.set("shift_assignment_id", shiftAssignmentId);
                      const q = params.toString();
                      router.push(`/app/line-overview${q ? `?${q}` : ""}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5" />
                    Assign eligible
                  </Button>
                </>
              )}
            </div>
          )}

          {rootCause?.missing && rootCause.missing.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Missing</p>
              <ul className="space-y-1">
                {rootCause.missing.map((item, idx) => (
                  <li key={`${item.code}-${idx}`} className="text-sm">
                    <span className="font-medium">{item.label}</span>
                    {item.required_level !== undefined && (
                      <span className="text-muted-foreground">
                        {" "}
                        (required {item.required_level}
                        {item.employee_level !== undefined && `, has ${item.employee_level}`})
                      </span>
                    )}
                    {item.valid_until && (
                      <span className="text-muted-foreground"> • valid until {item.valid_until}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Recommended actions</p>
            {recommendedActions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recommendedActions.map((action) => (
                  <Badge key={action} variant="secondary" className="rounded-full px-3 py-1 text-xs">
                    {formatActionLabel(action)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No recommendations available.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Actions logged</p>
            <div className="flex flex-wrap gap-2">
              {actions.map((action) => (
                <ActionChip
                  key={action}
                  label={formatActionLabel(action)}
                  active={selectedActions.includes(action)}
                  onClick={() => toggleAction(action)}
                />
              ))}
            </div>
            {selectedActions.includes("swap") && (
              <div className="rounded-sm border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                <p className="text-xs font-semibold text-amber-800">Swap is manual</p>
                <p className="text-xs text-muted-foreground">
                  Swap is a manual action; select the actual person in Line Overview.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (cockpitDate) params.set("date", cockpitDate);
                    if (cockpitShift) params.set("shift", cockpitShift);
                    if (cockpitLine && cockpitLine !== "all") params.set("line", cockpitLine);
                    const sid = rootCause?.details?.station_id?.trim();
                    if (sid) params.set("station_id", sid);
                    if (shiftAssignmentId) params.set("shift_assignment_id", shiftAssignmentId);
                    const q = params.toString();
                    router.push(`/app/line-overview${q ? `?${q}` : ""}`);
                  }}
                >
                  <ExternalLink className="h-3 w-3 mr-1.5" />
                  Open Line Overview
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="resolve-note">Notes (optional)</Label>
            <Textarea
              id="resolve-note"
              placeholder="Add context for this resolution..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {selectedActions.includes("swap") && note.trim().length < 10 && (
              <p className="text-xs text-amber-600">
                Add a short note (min 10 characters) to log the manual swap.
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleResolve}
              disabled={
                saving ||
                loading ||
                !shiftAssignmentId ||
                (selectedActions.includes("swap") && note.trim().length < 10)
              }
              className="min-w-[120px]"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Resolve
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
