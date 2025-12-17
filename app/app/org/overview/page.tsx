"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Building2, 
  Users, 
  User, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Upload
} from "lucide-react";
import { getOrgTree } from "@/services/org";
import { COPY } from "@/lib/copy";
import { isDemoMode, DEMO_ORG_UNITS } from "@/lib/demoData";
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
  const router = useRouter();
  const [orgTree, setOrgTree] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (isDemoMode()) {
        const demoUnits: OrgUnit[] = DEMO_ORG_UNITS.filter(u => !u.parentId).map(u => ({
          id: u.id,
          name: u.name,
          code: u.code,
          type: u.type,
          employeeCount: u.employeeCount,
          children: DEMO_ORG_UNITS.filter(c => c.parentId === u.id).map(c => ({
            id: c.id,
            name: c.name,
            code: c.code,
            type: c.type,
            employeeCount: c.employeeCount,
          })),
        }));
        setOrgTree(demoUnits);
        setLoading(false);
        return;
      }

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

  if (orgTree.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Organization Overview
            </h1>
            <p className="text-muted-foreground">
              0 units, 0 employees
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/admin/org-units/new")} data-testid="button-create-unit">
              <Plus className="h-4 w-4 mr-2" />
              {COPY.actions.createUnit}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowComingSoonModal(true)} 
              data-testid="button-import-org"
            >
              <Upload className="h-4 w-4 mr-2" />
              {COPY.actions.importOrgStructure}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {COPY.emptyStates.organization.title}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              {COPY.emptyStates.organization.description}
            </p>
            <Button onClick={() => router.push("/admin/org-units/new")} data-testid="button-create-unit-empty">
              <Plus className="h-4 w-4 mr-2" />
              {COPY.actions.createUnit}
            </Button>
          </CardContent>
        </Card>

        {showComingSoonModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-md mx-4">
              <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  CSV import for organization structure is coming soon. For now, please create units manually.
                </p>
                <Button onClick={() => setShowComingSoonModal(false)}>Close</Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

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
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Show employees</span>
            <Switch
              checked={showEmployees}
              onCheckedChange={setShowEmployees}
              data-testid="switch-show-employees"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/admin/org-units/new")} data-testid="button-create-unit">
              <Plus className="h-4 w-4 mr-2" />
              {COPY.actions.createUnit}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowComingSoonModal(true)} 
              data-testid="button-import-org"
            >
              <Upload className="h-4 w-4 mr-2" />
              {COPY.actions.importOrgStructure}
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {orgTree.map((unit) => (
          <OrgUnitCard key={unit.id} unit={unit} showEmployees={showEmployees} />
        ))}
      </div>

      {showComingSoonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                CSV import for organization structure is coming soon. For now, please create units manually.
              </p>
              <Button onClick={() => setShowComingSoonModal(false)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
