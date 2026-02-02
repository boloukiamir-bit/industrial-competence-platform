"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Building2, 
  Users, 
  User, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Upload,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { createOrgUnit } from "@/services/org";
import { COPY } from "@/lib/copy";
import { useOrg } from "@/hooks/useOrg";
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
  const { currentOrg } = useOrg();
  const [orgTree, setOrgTree] = useState<OrgUnit[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showEmployees, setShowEmployees] = useState(false);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [showCreateUnitModal, setShowCreateUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [newUnitCode, setNewUnitCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [totalUnitsRaw, setTotalUnitsRaw] = useState(0);
  const [rootUnitsCount, setRootUnitsCount] = useState(0);
  const [effectiveOrgId, setEffectiveOrgId] = useState<string | null>(null);
  const [unitsWarning, setUnitsWarning] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setUnitsWarning(null);
    try {
      const res = await fetch("/api/org/units", { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEffectiveOrgId(null);
        setOrgTree([]);
        setUnassignedCount(0);
        setTotalEmployees(0);
        if (res.status !== 403) console.error("Error loading org units:", json.error ?? res.statusText, json.details ?? "");
        return;
      }
      const tree = Array.isArray(json.tree) ? json.tree : [];
      const meta = (json.meta ?? {}) as Record<string, unknown>;
      const unitsRaw =
        typeof meta.totalUnitsRaw === "number" ? meta.totalUnitsRaw : tree.length;
      const rootsCount =
        typeof meta.rootUnitsCount === "number" ? meta.rootUnitsCount : tree.length;
      const employeesCount =
        typeof meta.totalEmployeesAfterSiteFilter === "number"
          ? meta.totalEmployeesAfterSiteFilter
          : typeof json.totalEmployees === "number"
            ? json.totalEmployees
            : 0;

      setOrgTree(tree);
      setUnassignedCount(typeof json.unassignedCount === "number" ? json.unassignedCount : 0);
      setTotalEmployees(employeesCount);
      setTotalUnitsRaw(unitsRaw);
      setRootUnitsCount(rootsCount);
      setEffectiveOrgId(json.activeOrgId ?? null);
      const metaWarning = typeof meta.warning === "string" ? meta.warning : null;
      const rootWarning =
        unitsRaw > 0 && rootsCount === 0
          ? "Org structure has no root unit (parent_id NULL). Set a top-level unit."
          : null;
      setUnitsWarning(metaWarning ?? rootWarning);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUnit = async () => {
    if (!newUnitName.trim() || !effectiveOrgId) return;
    
    setCreating(true);
    const result = await createOrgUnit({
      name: newUnitName.trim(),
      code: newUnitCode.trim() || undefined,
      orgId: effectiveOrgId,
    });
    
    if (result) {
      setNewUnitName("");
      setNewUnitCode("");
      setShowCreateUnitModal(false);
      await loadData();
    }
    setCreating(false);
  };

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

  // totalEmployees is now loaded separately to ensure it matches Employees page count

  if (orgTree.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Organization Overview
            </h1>
            <p className="text-muted-foreground">
              {totalUnitsRaw} units ({rootUnitsCount} roots), {totalEmployees} active employees
            </p>
            {unitsWarning && (
              <div className="mt-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 inline-block" data-testid="org-units-warning">
                <AlertTriangle className="h-4 w-4 inline-block mr-2 align-middle" />
                {unitsWarning}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowCreateUnitModal(true)} data-testid="button-create-unit">
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
            <Button onClick={() => setShowCreateUnitModal(true)} data-testid="button-create-unit-empty">
              <Plus className="h-4 w-4 mr-2" />
              {COPY.actions.createUnit}
            </Button>
          </CardContent>
        </Card>

        {unassignedCount > 0 && (
          <Card className="border-orange-200 dark:border-orange-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <span className="font-medium">Unassigned</span>
                  <Badge variant="destructive" className="text-xs ml-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {unassignedCount} employees
                  </Badge>
                </div>
                <span className="text-sm text-muted-foreground">
                  Employees without an assigned organization unit
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {showCreateUnitModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateUnitModal(false)}>
            <Card className="max-w-md mx-4 w-full" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Create Organization Unit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="unit-name">Unit Name *</Label>
                  <Input
                    id="unit-name"
                    placeholder="e.g., Manufacturing Division"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    data-testid="input-unit-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit-code">Code (optional)</Label>
                  <Input
                    id="unit-code"
                    placeholder="e.g., MFG"
                    value={newUnitCode}
                    onChange={(e) => setNewUnitCode(e.target.value)}
                    data-testid="input-unit-code"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleCreateUnit} disabled={!newUnitName.trim() || creating} data-testid="button-confirm-create">
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Unit
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateUnitModal(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showComingSoonModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="max-w-md mx-4">
              <CardHeader>
                <CardTitle>Coming Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  CSV import for organization structure is coming soon.
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
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-muted-foreground">
              {totalUnitsRaw} units ({rootUnitsCount} roots), {totalEmployees} active employees
            </p>
            {unassignedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {unassignedCount} unassigned
              </Badge>
            )}
          </div>
        </div>
        {unitsWarning && (
          <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="org-units-warning">
            <AlertTriangle className="h-4 w-4 inline-block mr-2 align-middle" />
            {unitsWarning}
          </div>
        )}
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
            <Button onClick={() => setShowCreateUnitModal(true)} data-testid="button-create-unit">
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
        {unassignedCount > 0 && (
          <Card className="mb-3 border-orange-200 dark:border-orange-800">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-6" />
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">Unassigned</span>
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {unassignedCount} unassigned
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Employees without an assigned organization unit
                  </p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {unassignedCount} employees
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {showCreateUnitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreateUnitModal(false)}>
          <Card className="max-w-md mx-4 w-full" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Create Organization Unit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="unit-name">Unit Name *</Label>
                <Input
                  id="unit-name"
                  placeholder="e.g., Manufacturing Division"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  data-testid="input-unit-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit-code">Code (optional)</Label>
                <Input
                  id="unit-code"
                  placeholder="e.g., MFG"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  data-testid="input-unit-code"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreateUnit} disabled={!newUnitName.trim() || creating} data-testid="button-confirm-create">
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Unit
                </Button>
                <Button variant="outline" onClick={() => setShowCreateUnitModal(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showComingSoonModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md mx-4">
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                CSV import for organization structure is coming soon.
              </p>
              <Button onClick={() => setShowComingSoonModal(false)}>Close</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
