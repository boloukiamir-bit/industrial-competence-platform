"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Building2, Users, User, ChevronDown, ChevronRight } from "lucide-react";
import { getOrgTree } from "@/services/org";
import type { OrgUnit } from "@/types/domain";

function OrgUnitCard({
  unit,
  showEmployees,
  level = 0,
}: {
  unit: OrgUnit;
  showEmployees: boolean;
  level?: number;
}) {
  const [expanded, setExpanded] = useState(level < 2);

  const hasChildren = unit.children && unit.children.length > 0;
  const hasEmployees = unit.employees && unit.employees.length > 0;

  return (
    <div className={level > 0 ? "ml-6 border-l-2 border-muted pl-4" : ""}>
      <Card className="mb-3">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            {(hasChildren || (showEmployees && hasEmployees)) ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setExpanded(!expanded)}
                data-testid={`button-toggle-${unit.id}`}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <div className="w-6" />
            )}

            <Building2 className="h-5 w-5 text-muted-foreground" />

            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium" data-testid={`text-unit-name-${unit.id}`}>
                  {unit.name}
                </span>
                {unit.code && (
                  <Badge variant="outline" className="text-xs">
                    {unit.code}
                  </Badge>
                )}
                {unit.type && (
                  <Badge variant="secondary" className="text-xs">
                    {unit.type}
                  </Badge>
                )}
              </div>
              {unit.managerName && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <User className="h-3 w-3" /> Manager: {unit.managerName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-sm" data-testid={`text-employee-count-${unit.id}`}>
                {unit.employeeCount || 0} employees
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded && (
        <>
          {showEmployees && hasEmployees && (
            <div className="ml-10 mb-3 space-y-1">
              {unit.employees?.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-2 text-sm text-muted-foreground p-2 rounded hover-elevate"
                >
                  <User className="h-4 w-4" />
                  <span>{emp.name}</span>
                  {emp.role && <Badge variant="outline" className="text-xs">{emp.role}</Badge>}
                </div>
              ))}
            </div>
          )}

          {hasChildren &&
            unit.children?.map((child) => (
              <OrgUnitCard
                key={child.id}
                unit={child}
                showEmployees={showEmployees}
                level={level + 1}
              />
            ))}
        </>
      )}
    </div>
  );
}

export default function OrgOverviewPage() {
  const [orgTree, setOrgTree] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);

  useEffect(() => {
    async function loadData() {
      const tree = await getOrgTree();
      setOrgTree(tree);
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const totalEmployees = orgTree.reduce((sum, u) => sum + (u.employeeCount || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Organization Overview
          </h1>
          <p className="text-muted-foreground">
            {orgTree.length} units, {totalEmployees} total employees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show employees</span>
          <Switch
            checked={showEmployees}
            onCheckedChange={setShowEmployees}
            data-testid="switch-show-employees"
          />
        </div>
      </div>

      {orgTree.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organization units found. Create units to build your org structure.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orgTree.map((unit) => (
            <OrgUnitCard key={unit.id} unit={unit} showEmployees={showEmployees} />
          ))}
        </div>
      )}
    </div>
  );
}
