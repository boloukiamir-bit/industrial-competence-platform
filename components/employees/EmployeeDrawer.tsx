"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AlertCircle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/coreFetch";

export type EmployeeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Employee UUID; when set and open, fetches details. */
  employeeId?: string | null;
};

type EmployeePayload = {
  id?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  employeeNumber?: string;
  employee_number?: string;
  email?: string;
  role?: string;
  line?: string;
  lineCode?: string;
  team?: string;
  area?: string;
  status?: string;
};

function fullName(e: EmployeePayload): string {
  const first = (e.firstName ?? e.first_name)?.trim();
  const last = (e.lastName ?? e.last_name)?.trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return e.name ?? "—";
}

function empNo(e: EmployeePayload): string {
  return e.employeeNumber ?? e.employee_number ?? "—";
}

export function EmployeeDrawer({
  open,
  onOpenChange,
  employeeId,
}: EmployeeDrawerProps) {
  const [employee, setEmployee] = useState<EmployeePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

  const fetchEmployee = useCallback(async () => {
    if (!employeeId) {
      setEmployee(null);
      setError(null);
      setErrorStatus(null);
      return;
    }
    setLoading(true);
    setError(null);
    setErrorStatus(null);
    const res = await fetchJson<{ ok?: boolean; employee?: EmployeePayload }>(`/api/employees/${employeeId}`);
    if (!res.ok) {
      const status = "status" in res ? res.status : 0;
      setError("Could not load employee details.");
      setErrorStatus(status);
      setEmployee(null);
      setLoading(false);
      if (process.env.NODE_ENV !== "production") {
        console.log("[ui] employee-drawer-fetch-error", {
          employeeId,
          status,
          bodySnippet: res.error ?? "(no message)",
        });
      }
      return;
    }
    const data = res.data as { ok?: boolean; employee?: EmployeePayload };
    setEmployee(data?.employee ?? null);
    setError(null);
    setErrorStatus(null);
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    if (open && employeeId) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[ui] employee-drawer-open", { employeeId });
      }
      fetchEmployee();
    } else {
      setEmployee(null);
      setError(null);
      setLoading(false);
    }
  }, [open, employeeId, fetchEmployee]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Employee details</SheetTitle>
          <SheetDescription>
            Read-only details from roster
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground py-6">Loading employee details…</p>
          )}

          {error && (
            <div
              className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 flex items-start gap-2"
              role="alert"
            >
              <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium text-destructive">{error}</p>
                {errorStatus != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">Status: {errorStatus}</p>
                )}
              </div>
            </div>
          )}

          {!loading && !error && employee && (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</dt>
                <dd className="mt-0.5 font-medium">{fullName(employee)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee number</dt>
                <dd className="mt-0.5 tabular-nums">{empNo(employee)}</dd>
              </div>
              {employee.team != null && String(employee.team).trim() !== "" && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</dt>
                  <dd className="mt-0.5">{employee.team}</dd>
                </div>
              )}
              {(employee.line ?? employee.lineCode) != null && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Line</dt>
                  <dd className="mt-0.5">{employee.line ?? employee.lineCode ?? "—"}</dd>
                </div>
              )}
              {employee.area != null && String(employee.area).trim() !== "" && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Area</dt>
                  <dd className="mt-0.5">{employee.area}</dd>
                </div>
              )}
              {employee.status != null && String(employee.status).trim() !== "" && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</dt>
                  <dd className="mt-0.5">{employee.status}</dd>
                </div>
              )}
              {employee.email && (
                <div>
                  <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</dt>
                  <dd className="mt-0.5 break-all">{employee.email}</dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
