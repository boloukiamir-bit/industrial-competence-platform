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
import { getOrgTree, createOrgUnit, type OrgTreeResult } from "@/services/org";
import { COPY } from "@/lib/copy";
import { isDemoMode, getDemoOrgUnits } from "@/lib/demoRuntime";
import { useOrg } from "@/hooks/useOrg";
import { supabase } from "@/lib/supabaseClient";
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

  const loadData = async () => {
    if (isDemoMode()) {
      const allUnits = getDemoOrgUnits();
      const rootUnits = allUnits.filter(u => !u.parentId);
      const demoUnits: OrgUnit[] = rootUnits.map(u => ({
        ...u,
        children: allUnits.filter(c => c.parentId === u.id),
      }));
      setOrgTree(demoUnits);
      setUnassignedCount(0); // Demo mode: no unassigned employees
      // Demo mode: use sum of unit employeeCounts
      const demoTotal = demoUnits.reduce((sum, u) => sum + (u.employeeCount || 0), 0);
      setTotalEmployees(demoTotal);
      setLoading(false);
      return;
    }

    if (!currentOrg) {
      setOrgTree([]);
      setUnassignedCount(0);
      setTotalEmployees(0);
      setLoading(false);
      return;
    }

    // Load org tree (for unit structure and unit-specific employee counts)
    const result: OrgTreeResult = await getOrgTree(currentOrg.id);
    setOrgTree(result.tree);
    setUnassignedCount(result.unassignedCount);

    // Helper to check if error indicates missing is_active column
    const isMissingColumnError = (err: any): boolean => {
      if (!err) return false;
      const code = err.code;
      const message = err.message?.toLowerCase() || "";
      return (
        code === "42703" || // PostgreSQL undefined column
        message.includes("is_active") && (
          message.includes("does not exist") ||
          message.includes("column") && message.includes("not found")
        )
      );
    };

    // Tenant-scoped: Count ALL active employees for the org (same source as Employees page)
    // This ensures consistency between Employees page count and Org Overview total
    // First attempt WITH is_active filter
    let countQuery = supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("org_id", currentOrg.id)
      .eq("is_active", true);

    let { count, error } = await countQuery;

    // If error indicates missing is_active column, retry without it
    if (error && isMissingColumnError(error)) {
      countQuery = supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id);
      
      const retryResult = await countQuery;
      count = retryResult.count;
      error = retryResult.error;
    }

    if (error) {
      console.error("Error counting employees:", error);
      setTotalEmployees(0);
    } else {
      setTotalEmployees(count || 0);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentOrg]);

  const handleCreateUnit = async () => {
    if (!newUnitName.trim() || !currentOrg) return;
    
    setCreating(true);
    const result = await createOrgUnit({
      name: newUnitName.trim(),
      code: newUnitCode.trim() || undefined,
      orgId: currentOrg.id,
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
              0 units, 0 employees
            </p>
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
              {orgTree.length} units, {totalEmployees} total employees
            </p>
            {unassignedCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {unassignedCount} unassigned
              </Badge>
            )}
          </div>
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
