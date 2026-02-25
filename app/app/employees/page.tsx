"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, Search, Upload, UserPlus, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { COPY } from "@/lib/copy";
import { useOrg } from "@/hooks/useOrg";
import type { Employee } from "@/types/domain";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";
import { EmployeeActionsMenu } from "@/components/employees/EmployeeActionsMenu";
import { EmployeeEditDrawer } from "@/components/employees/EmployeeEditDrawer";

export default function EmployeesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight_id")?.trim() ?? null;
  const { currentOrg } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [highlightedEmployeeId, setHighlightedEmployeeId] = useState<string | null>(null);
  const handledHighlightIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lineFilter, setLineFilter] = useState<string>("");
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [deactivateEmployee, setDeactivateEmployee] = useState<Employee | null>(null);
  const [terminateEmployee, setTerminateEmployee] = useState<Employee | null>(null);
  const [terminationDate, setTerminationDate] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [editEmployeeId, setEditEmployeeId] = useState<string | null>(null);
  const [editInitial, setEditInitial] = useState<{
    firstName?: string;
    lastName?: string;
    employeeNumber?: string;
    email?: string;
    phone?: string;
    title?: string;
    hireDate?: string;
  } | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const { toast } = useToast();

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = lineFilter
        ? `/api/employees?lineCode=${encodeURIComponent(lineFilter)}`
        : "/api/employees";
      const res = await fetch(url, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmployees([]);
        const message = json.error ?? res.statusText;
        const requestId = json.requestId ?? res.headers.get("x-request-id") ?? null;
        const errorDetail = json.errorDetail ?? null;
        const friendly = res.status === 401 ? "Invalid or expired session" : String(message || "Request failed");
        const toastMessage =
          res.status === 401
            ? "Request failed (401) — Session expired. Please reload/login."
            : `Request failed (${res.status}) — ${friendly}`;
        toast({ title: toastMessage, variant: "destructive" });
        const displayError = errorDetail
          ? `${friendly}\n\n${errorDetail}`
          : requestId
            ? `${friendly} (requestId: ${requestId})`
            : friendly;
        setError(displayError);
        return;
      }
      const list = Array.isArray(json.employees) ? json.employees : [];
      setEmployees(
        list.map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          name: String(row.name ?? ""),
          firstName: row.firstName as string | undefined,
          lastName: row.lastName as string | undefined,
          employeeNumber: String(row.employeeNumber ?? ""),
          email: row.email as string | undefined,
          phone: row.phone as string | undefined,
          dateOfBirth: row.dateOfBirth as string | undefined,
          role: String(row.role ?? ""),
          line: String(row.line ?? ""),
          lineCode: String((row as { lineCode?: string }).lineCode ?? row.line ?? ""),
          team: String(row.team ?? ""),
          employmentType: (row.employmentType as string) ?? "permanent",
          startDate: row.startDate as string | undefined,
          contractEndDate: row.contractEndDate as string | undefined,
          managerId: row.managerId as string | undefined,
          managerName: undefined,
          address: row.address as string | undefined,
          city: row.city as string | undefined,
          postalCode: row.postalCode as string | undefined,
          country: (row.country as string) ?? "Sweden",
          isActive: row.isActive !== false,
          employmentStatus: (row as { employmentStatus?: string }).employmentStatus ?? "ACTIVE",
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [toast, lineFilter]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    async function loadLines() {
      try {
        const res = await fetch("/api/lines", { credentials: "include", headers: withDevBearer() });
        const json = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(json.lines)) {
          setLines(json.lines);
          if (json.source) console.debug("[lines] source:", json.source);
        } else {
          setLines([]);
        }
      } catch {
        setLines([]);
      }
    }
    loadLines();
  }, []);

  useEffect(() => {
    if (!menuRowId) return;
    const close = () => setMenuRowId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuRowId]);

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLine = !lineFilter || (e as { lineCode?: string }).lineCode === lineFilter || e.line === lineFilter;
    return matchesSearch && matchesLine;
  });

  useEffect(() => {
    if (!highlightId || loading || handledHighlightIdRef.current === highlightId) return;
    const emp = employees.find((e) => e.id === highlightId);
    if (!emp) {
      if (employees.length > 0) {
        handledHighlightIdRef.current = highlightId;
        toast({ title: "Employee not found", variant: "destructive" });
      }
      return;
    }
    const inFiltered = filteredEmployees.some((e) => e.id === highlightId);
    if (!inFiltered) {
      handledHighlightIdRef.current = highlightId;
      toast({ title: "Employee not found in current filter", variant: "destructive" });
      return;
    }
    handledHighlightIdRef.current = highlightId;
    setHighlightedEmployeeId(highlightId);
    setEditEmployeeId(highlightId);
    setEditInitial({
      firstName: emp.firstName,
      lastName: emp.lastName,
      employeeNumber: emp.employeeNumber,
      email: emp.email,
      phone: emp.phone,
      title: (emp as { title?: string }).title,
      hireDate: (emp as { hireDate?: string }).hireDate,
    });
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-employee-id="${highlightId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const t = setTimeout(() => setHighlightedEmployeeId(null), 3000);
    return () => clearTimeout(t);
  }, [highlightId, loading, employees, filteredEmployees, toast]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-10 w-10 mx-auto text-destructive mb-3" />
            <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap break-words">{error}</p>
            <p className="text-xs text-muted-foreground mb-4 font-mono">
              If you see a requestId above, share it when reporting the issue.
            </p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Employees
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/app/import-employees")} data-testid="button-import-csv">
              <Upload className="h-4 w-4 mr-2" />
              {COPY.actions.importCsv}
            </Button>
            <Button variant="outline" onClick={() => router.push("/app/employees/new")} data-testid="button-add-employee">
              <UserPlus className="h-4 w-4 mr-2" />
              {COPY.actions.addEmployee}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No employees imported yet.
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Import employees from CSV or add them manually to get started.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => router.push("/app/import-employees")} data-testid="button-import-csv-empty">
                <Upload className="h-4 w-4 mr-2" />
                Import employees
              </Button>
              <Button variant="outline" onClick={() => router.push("/app/employees/new")} data-testid="button-add-employee-empty">
                <UserPlus className="h-4 w-4 mr-2" />
                {COPY.actions.addEmployee}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-gray-600 dark:text-gray-400" />
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Employees
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Active employees ({filteredEmployees.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => router.push("/app/import-employees")} data-testid="button-import-csv">
            <Upload className="h-4 w-4 mr-2" />
            {COPY.actions.importCsv}
          </Button>
          <Button variant="outline" onClick={() => router.push("/app/employees/new")} data-testid="button-add-employee">
            <UserPlus className="h-4 w-4 mr-2" />
            {COPY.actions.addEmployee}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or employee number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            data-testid="input-search-employees"
          />
        </div>
        <select
          value={lineFilter}
          onChange={(e) => setLineFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-testid="select-line-filter"
        >
          <option value="">All Lines</option>
          {lines.map((line) => (
            <option key={line} value={line}>
              {line}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Employee No
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Line
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Team
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Role
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmployees.map((employee) => (
              <tr
                key={employee.id}
                data-employee-id={employee.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  highlightedEmployeeId === employee.id
                    ? "bg-primary/15 ring-1 ring-primary/30"
                    : ""
                }`}
                data-testid={`row-employee-${employee.id}`}
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/app/employees/${employee.id}`}
                    className="font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                    data-testid={`link-employee-${employee.id}`}
                  >
                    {employee.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {employee.employeeNumber}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {employee.line || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {employee.team || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                  {employee.role || "-"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      (employee as { employmentStatus?: string }).employmentStatus === "TERMINATED"
                        ? "bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
                        : (employee as { employmentStatus?: string }).employmentStatus === "INACTIVE"
                          ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200"
                          : "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200"
                    }`}
                  >
                    {(employee as { employmentStatus?: string }).employmentStatus ?? "ACTIVE"}
                  </span>
                </td>
                <td className="px-4 py-3 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuRowId(menuRowId === employee.id ? null : employee.id);
                    }}
                    data-testid={`menu-trigger-${employee.id}`}
                    aria-label="Actions"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                  {menuRowId === employee.id && (
                    <EmployeeActionsMenu
                      employee={employee}
                      onClose={() => setMenuRowId(null)}
                      onEdit={() => {
                        setEditEmployeeId(employee.id);
                        setEditInitial({
                          firstName: employee.firstName,
                          lastName: employee.lastName,
                          employeeNumber: employee.employeeNumber,
                          email: employee.email,
                          phone: employee.phone,
                          title: (employee as { title?: string }).title,
                          hireDate: (employee as { hireDate?: string }).hireDate,
                        });
                      }}
                      onDeactivate={() => setDeactivateEmployee(employee)}
                      onTerminate={() => {
                        setTerminateEmployee(employee);
                        setTerminationDate("");
                      }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!deactivateEmployee} onOpenChange={(open) => !open && setDeactivateEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate employee</DialogTitle>
            <DialogDescription>
              {deactivateEmployee
                ? `Set employment status to INACTIVE for ${deactivateEmployee.name} (${deactivateEmployee.employeeNumber})?`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeactivateEmployee(null)}
              disabled={deactivating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deactivating}
              onClick={async () => {
                if (!deactivateEmployee) return;
                setDeactivating(true);
                try {
                  const res = await fetch(`/api/employees/${deactivateEmployee.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...withDevBearer() },
                    body: JSON.stringify({ employment_status: "INACTIVE" }),
                    credentials: "include",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data?.ok) {
                    toast({ title: "Employee deactivated" });
                    setDeactivateEmployee(null);
                    await loadEmployees();
                  } else {
                    if (res.status === 403) toast({ title: "You do not have access", variant: "destructive" });
                    else if (res.status === 404) toast({ title: "Employee not found (maybe moved org)", variant: "destructive" });
                    else toast({ title: data?.error?.details?.[0] ?? "Deactivate failed", variant: "destructive" });
                  }
                } finally {
                  setDeactivating(false);
                }
              }}
            >
              {deactivating ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!terminateEmployee} onOpenChange={(open) => !open && setTerminateEmployee(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate employee</DialogTitle>
            <DialogDescription>
              {terminateEmployee
                ? `Set employment status to TERMINATED for ${terminateEmployee.name} (${terminateEmployee.employeeNumber}). Enter termination date.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <label htmlFor="termination-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Termination date
            </label>
            <input
              id="termination-date"
              type="date"
              value={terminationDate}
              onChange={(e) => setTerminationDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTerminateEmployee(null)}
              disabled={terminating}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={terminating || !terminationDate.trim()}
              onClick={async () => {
                if (!terminateEmployee || !terminationDate.trim()) return;
                setTerminating(true);
                try {
                  const res = await fetch(`/api/employees/${terminateEmployee.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...withDevBearer() },
                    body: JSON.stringify({
                      employment_status: "TERMINATED",
                      termination_date: terminationDate.trim(),
                    }),
                    credentials: "include",
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data?.ok) {
                    toast({ title: "Employee terminated" });
                    setTerminateEmployee(null);
                    setTerminationDate("");
                    await loadEmployees();
                  } else {
                    if (res.status === 403) toast({ title: "You do not have access", variant: "destructive" });
                    else if (res.status === 404) toast({ title: "Employee not found (maybe moved org)", variant: "destructive" });
                    else toast({ title: data?.error?.details?.[0] ?? "Terminate failed", variant: "destructive" });
                  }
                } finally {
                  setTerminating(false);
                }
              }}
            >
              {terminating ? "Terminating…" : "Terminate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EmployeeEditDrawer
        open={!!editEmployeeId}
        onOpenChange={(open) => !open && setEditEmployeeId(null)}
        employeeId={editEmployeeId}
        initial={editInitial}
        onSaved={loadEmployees}
      />
    </div>
  );
}
