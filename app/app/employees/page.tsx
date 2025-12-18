"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, ChevronRight, Upload, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { COPY } from "@/lib/copy";
import { isDemoMode, DEMO_EMPLOYEES } from "@/lib/demoData";
import { useOrg } from "@/hooks/useOrg";
import type { Employee } from "@/types/domain";

export default function EmployeesPage() {
  const router = useRouter();
  const { currentOrg } = useOrg();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [lineFilter, setLineFilter] = useState<string>("");

  useEffect(() => {
    async function loadEmployees() {
      if (isDemoMode()) {
        setEmployees(
          DEMO_EMPLOYEES.map((e) => ({
            id: e.id,
            name: e.name,
            firstName: e.firstName,
            lastName: e.lastName,
            employeeNumber: e.employeeNumber,
            email: e.email,
            role: e.role,
            line: e.line,
            team: e.team,
            startDate: e.startDate,
            isActive: e.isActive,
            country: "Sweden",
            employmentType: "permanent",
          }))
        );
        setLoading(false);
        return;
      }

      if (!currentOrg) {
        setLoading(false);
        return;
      }

      // Note: org_id filtering disabled until Supabase schema is updated
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (!error && data) {
        setEmployees(
          data.map((row) => ({
            id: row.id,
            name: row.name || "",
            firstName: row.first_name || undefined,
            lastName: row.last_name || undefined,
            employeeNumber: row.employee_number || "",
            email: row.email || undefined,
            phone: row.phone || undefined,
            dateOfBirth: row.date_of_birth || undefined,
            role: row.role || "",
            line: row.line || "",
            team: row.team || "",
            employmentType: row.employment_type || "permanent",
            startDate: row.start_date || undefined,
            contractEndDate: row.contract_end_date || undefined,
            managerId: row.manager_id || undefined,
            managerName: undefined,
            address: row.address || undefined,
            city: row.city || undefined,
            postalCode: row.postal_code || undefined,
            country: row.country || "Sweden",
            isActive: row.is_active ?? true,
          }))
        );
      } else if (error) {
        console.error("Error loading employees:", error);
      }
      setLoading(false);
    }
    loadEmployees();
  }, [currentOrg]);

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
              {COPY.emptyStates.employees.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {COPY.emptyStates.employees.description}
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button onClick={() => router.push("/app/import-employees")} data-testid="button-import-csv-empty">
                <Upload className="h-4 w-4 mr-2" />
                {COPY.actions.importCsv}
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
            ({filteredEmployees.length})
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
                <td className="px-4 py-3">
                  <Link
                    href={`/app/employees/${employee.id}`}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
