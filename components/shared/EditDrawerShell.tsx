"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export type EditDrawerShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Form/content body */
  children: React.ReactNode;
  /** Called when user clicks Save. Caller should perform PATCH and then close/refresh. */
  onSave: () => void | Promise<void>;
  /** True while save request is in flight; disables Save and Cancel */
  saving?: boolean;
  /** Inline error message to show above actions (e.g. validation or API error) */
  error?: string | null;
  /** Optional test id for the Save button */
  saveTestId?: string;
};

/**
 * Standard edit drawer shell per Editability Contract: drawer (never modal),
 * title, description, error slot, Save (with loading state) + Cancel.
 */
export function EditDrawerShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSave,
  saving = false,
  error = null,
  saveTestId = "edit-drawer-save",
}: EditDrawerShellProps) {
  const handleSave = async () => {
    await onSave();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {error && (
            <p className="text-sm text-destructive font-medium" role="alert">
              {error}
            </p>
          )}
          {children}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              data-testid={saveTestId}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
