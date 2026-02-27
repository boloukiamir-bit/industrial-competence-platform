"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { isSafeAppReturnTo } from "@/lib/utils";

export type UnassignedEmployee = {
  id: string;
  name: string;
  site_id: string | null;
  org_unit_id: string | null;
};

const RETURN_TO_OVERVIEW = "/app/org/overview";

export function UnassignedEmployeesModal({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: UnassignedEmployee[];
}) {
  const router = useRouter();

  const handleFix = (employeeId: string) => {
    onOpenChange(false);
    const returnTo = isSafeAppReturnTo(RETURN_TO_OVERVIEW) ? RETURN_TO_OVERVIEW : "";
    const url = returnTo
      ? `/app/employees/${encodeURIComponent(employeeId)}?edit=1&return_to=${encodeURIComponent(returnTo)}`
      : `/app/employees/${encodeURIComponent(employeeId)}?edit=1`;
    router.push(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Unassigned employees</DialogTitle>
          <DialogDescription>
            Employees missing site or org unit. Click Fix to open the employee and assign.
          </DialogDescription>
        </DialogHeader>
        <ul className="overflow-y-auto space-y-2 pr-2 -mr-2">
          {employees.length === 0 ? (
            <li className="text-sm text-muted-foreground py-4">No unassigned employees.</li>
          ) : (
            employees.map((emp) => (
              <li
                key={emp.id}
                className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="font-medium truncate">{emp.name}</span>
                  <div className="flex gap-1 flex-shrink-0">
                    {emp.site_id == null && (
                      <Badge variant="secondary" className="text-xs">
                        Missing site
                      </Badge>
                    )}
                    {emp.org_unit_id == null && (
                      <Badge variant="secondary" className="text-xs">
                        Missing org unit
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleFix(emp.id)}>
                  Fix
                </Button>
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
