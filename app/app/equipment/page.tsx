"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Package, CheckCircle, Loader2 } from "lucide-react";
import type { Equipment, Employee } from "@/types/domain";
import { useOrg } from "@/hooks/useOrg";

interface EquipmentWithAssignment extends Equipment {
  assignedTo?: string;
  assignmentId?: string;
  assignmentStatus?: string;
}

export default function EquipmentPage() {
  const { currentOrg } = useOrg();
  const [equipment, setEquipment] = useState<EquipmentWithAssignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEquipment, setNewEquipment] = useState({ name: "", serialNumber: "", category: "" });

  const fetchData = async () => {
    if (!currentOrg) {
      setEquipment([]);
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: equipmentData } = await supabase.from("equipment").select("*");
    const { data: assignmentsData } = await supabase
      .from("employee_equipment")
      .select("*, employees:employee_id(name)")
      .eq("status", "assigned");
    const { data: employeesData } = await supabase
      .from("employees")
      .select("id, name, employee_number, role, line, team, is_active")
      .eq("org_id", currentOrg.id)
      .eq("is_active", true);

    const equipmentWithAssignments: EquipmentWithAssignment[] = (equipmentData || []).map((eq: any) => {
      const assignment = (assignmentsData || []).find((a: any) => a.equipment_id === eq.id);
      return {
        id: eq.id,
        name: eq.name,
        serialNumber: eq.serial_number,
        category: eq.category,
        requiredForRole: eq.required_for_role,
        assignedTo: assignment?.employees?.name,
        assignmentId: assignment?.id,
        assignmentStatus: assignment?.status,
      };
    });

    setEquipment(equipmentWithAssignments);
    setEmployees((employeesData || []).map((e: any) => ({
      id: e.id,
      name: e.name,
      employeeNumber: e.employee_number,
      role: e.role,
      line: e.line,
      team: e.team,
      employmentType: 'permanent',
      isActive: e.is_active,
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentOrg]);

  const handleAddEquipment = async () => {
    if (!newEquipment.name || !newEquipment.serialNumber) return;

    await supabase.from("equipment").insert({
      name: newEquipment.name,
      serial_number: newEquipment.serialNumber,
      category: newEquipment.category || null,
    });

    setNewEquipment({ name: "", serialNumber: "", category: "" });
    setShowAddForm(false);
    fetchData();
  };

  const handleAssignEquipment = async (equipmentId: string, employeeId: string) => {
    const returnDate = new Date();
    returnDate.setFullYear(returnDate.getFullYear() + 1);

    await supabase.from("employee_equipment").insert({
      equipment_id: equipmentId,
      employee_id: employeeId,
      assigned_date: new Date().toISOString().slice(0, 10),
      return_date: returnDate.toISOString().slice(0, 10),
      status: "assigned",
    });

    fetchData();
  };

  const handleReturnEquipment = async (assignmentId: string) => {
    await supabase
      .from("employee_equipment")
      .update({ status: "returned", return_date: new Date().toISOString().slice(0, 10) })
      .eq("id", assignmentId);

    fetchData();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Equipment Management</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-equipment">
          <Plus className="h-4 w-4 mr-2" />
          Add Equipment
        </Button>
      </div>

      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Add New Equipment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Name"
                value={newEquipment.name}
                onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                data-testid="input-equipment-name"
              />
              <Input
                placeholder="Serial Number"
                value={newEquipment.serialNumber}
                onChange={(e) => setNewEquipment({ ...newEquipment, serialNumber: e.target.value })}
                data-testid="input-equipment-serial"
              />
              <Input
                placeholder="Category"
                value={newEquipment.category}
                onChange={(e) => setNewEquipment({ ...newEquipment, category: e.target.value })}
                data-testid="input-equipment-category"
              />
            </div>
            <Button className="mt-4" onClick={handleAddEquipment} data-testid="button-save-equipment">
              Save Equipment
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {equipment.map((eq) => (
          <Card key={eq.id} data-testid={`card-equipment-${eq.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  {eq.name}
                </CardTitle>
                {eq.assignedTo ? (
                  <Badge variant="secondary">Assigned</Badge>
                ) : (
                  <Badge variant="outline">Available</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">S/N: {eq.serialNumber}</p>
              {eq.category && <p className="text-sm text-muted-foreground mb-2">Category: {eq.category}</p>}

              {eq.assignedTo ? (
                <div className="mt-3">
                  <p className="text-sm mb-2">Assigned to: <span className="font-medium">{eq.assignedTo}</span></p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => eq.assignmentId && handleReturnEquipment(eq.assignmentId)}
                    data-testid={`button-return-${eq.id}`}
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Mark Returned
                  </Button>
                </div>
              ) : (
                <div className="mt-3">
                  <Select onValueChange={(value: string) => handleAssignEquipment(eq.id, value)}>
                    <SelectTrigger data-testid={`select-assign-${eq.id}`}>
                      <SelectValue placeholder="Assign to employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {equipment.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No equipment registered. Click &quot;Add Equipment&quot; to get started.
          </div>
        )}
      </div>
    </div>
  );
}
