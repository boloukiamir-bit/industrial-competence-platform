"use client";

import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";

export type EditableCardProps = {
  /** Card title (e.g. "Job & Employment") */
  title: string;
  /** Whether to show the pencil Edit button */
  canEdit: boolean;
  /** Called when user clicks the pencil (or "Edit" from menu). Opens the edit drawer. */
  onEdit: () => void;
  /** Card body content */
  children: React.ReactNode;
  /** Optional footer actions (e.g. "Add" CTA). Rendered only if provided. */
  footer?: React.ReactNode;
  /** Optional data-testid for the pencil button */
  editTestId?: string;
};

/**
 * Card with optional pencil Edit in header. Aligns with Editability Contract:
 * UI entry point = pencil on card + "Edit" in kebab menu.
 */
export function EditableCard({
  title,
  canEdit,
  onEdit,
  children,
  footer,
  editTestId = "editable-card-edit",
}: EditableCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>{title}</CardTitle>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onEdit}
            aria-label="Edit"
            data-testid={editTestId}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer != null && <CardFooter>{footer}</CardFooter>}
    </Card>
  );
}
