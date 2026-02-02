"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, ChevronRight, Upload, UserPlus, MoreVertical } from "lucide-react";
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

export default function EmployeesPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [lineFilter, setLineFilter] = useState<string>("");
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [deactivateEmployee, setDeactivateEmployee] = useState<Employee | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const { toast } = useToast();

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmployees([]);
        const message = json.error ?? res.statusText;
        const friendly = res.status === 401 ? "Invalid or expired session" : String(message || "Request failed");
        const toastMessage =
          res.status === 401
            ? "Request failed (401) — Session expired. Please reload/login."
            : `Request failed (${res.status}) — ${friendly}`;
        toast({ title: toastMessage, variant: "destructive" });
        setError(friendly);
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
        }))
      );
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    if (!menuRowId) return;
    const close = () => setMenuRowId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuRowId]);

  const lines = [...new Set(employees.map((e) => e.line).filter(Boolean))].sort();

  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.employeeNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLine = !lineFilter || e.line === lineFilter;
    return matchesSearch && matchesLine;
  });

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
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
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
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredEmployees.map((employee) => (
              <tr
                key={employee.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border bg-white dark:bg-gray-800 shadow-lg py-1"
                      role="menu"
                    >
                      <Link
                        href={`/app/employees/${employee.id}`}
                        className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                        onClick={() => setMenuRowId(null)}
                      >
                        View
                      </Link>
                      <Link
                        href={`/app/employees/${employee.id}`}
                        className="block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                        onClick={() => setMenuRowId(null)}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                        role="menuitem"
                        onClick={() => {
                          setDeactivateEmployee(employee);
                          setMenuRowId(null);
                        }}
                      >
                        Deactivate
                      </button>
                    </div>
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
                ? `Deactivate employee ${deactivateEmployee.name} (${deactivateEmployee.employeeNumber})?`
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
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_active: false }),
                    credentials: "include",
                  });
                  if (res.ok) {
                    setDeactivateEmployee(null);
                    await loadEmployees();
                  } else {
                    const j = await res.json().catch(() => ({}));
                    console.error("Deactivate failed", j);
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
    </div>
  );
}
