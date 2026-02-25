"use client";

import Link from "next/link";
import { UserPen, UserMinus, UserX } from "lucide-react";
import type { Employee } from "@/types/domain";

export type EmployeeActionsMenuProps = {
  employee: Employee;
  onClose: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
  onTerminate: () => void;
  /** If true, hide Deactivate/Terminate (e.g. already INACTIVE/TERMINATED). */
  disableLifecycle?: boolean;
};

export function EmployeeActionsMenu({
  employee,
  onClose,
  onEdit,
  onDeactivate,
  onTerminate,
  disableLifecycle,
}: EmployeeActionsMenuProps) {
  const status = (employee as { employmentStatus?: string }).employmentStatus ?? "ACTIVE";
  const canDeactivate = status === "ACTIVE";
  const canTerminate = status === "ACTIVE" || status === "INACTIVE";

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
      {!disableLifecycle && (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
            disabled={!canDeactivate}
            onClick={() => {
              onDeactivate();
              onClose();
            }}
          >
            <UserMinus className="h-3.5 w-3.5" />
            Deactivate
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-destructive hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            role="menuitem"
            disabled={!canTerminate}
            onClick={() => {
              onTerminate();
              onClose();
            }}
          >
            <UserX className="h-3.5 w-3.5" />
            Terminate
          </button>
        </>
      )}
    </div>
  );
}
