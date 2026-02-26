"use client";

import Link from "next/link";
import { UserPen, UserMinus } from "lucide-react";
import type { Employee } from "@/types/domain";

export type EmployeeActionsMenuProps = {
  employee: Employee;
  onClose: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
};

export function EmployeeActionsMenu({
  employee,
  onClose,
  onEdit,
  onDeactivate,
}: EmployeeActionsMenuProps) {
  const isActive = employee.isActive !== false;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-border bg-background shadow-lg py-1"
      role="menu"
    >
      <Link
        href={`/app/employees/${employee.id}`}
        className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
        role="menuitem"
        onClick={onClose}
      >
        View
      </Link>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-muted"
        role="menuitem"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <UserPen className="h-3.5 w-3.5" />
        Edit
      </button>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        role="menuitem"
        disabled={!isActive}
        onClick={() => {
          onDeactivate();
          onClose();
        }}
      >
        <UserMinus className="h-3.5 w-3.5" />
        Deactivate
      </button>
    </div>
  );
}
