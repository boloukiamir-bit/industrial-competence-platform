"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";

export type EmployeeEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  initial?: {
    firstName?: string;
    lastName?: string;
    employeeNumber?: string;
    email?: string;
    phone?: string;
    title?: string;
    hireDate?: string;
  } | null;
  onSaved?: () => void;
};

type PatchError = { code?: string; details?: string[] };

export function EmployeeEditDrawer({
  open,
  onOpenChange,
  employeeId,
  initial,
  onSaved,
}: EmployeeEditDrawerProps) {
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFirstName(initial?.firstName ?? "");
    setLastName(initial?.lastName ?? "");
    setEmployeeNumber(initial?.employeeNumber ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setTitle(initial?.title ?? "");
    setHireDate(initial?.hireDate ?? "");
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const handleSave = async () => {
    if (!employeeId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        credentials: "include",
        body: JSON.stringify({
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          employee_number: employeeNumber.trim() || undefined,
          email: email.trim() || null,
          phone: phone.trim() || null,
          title: title.trim() || null,
          hire_date: hireDate.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        toast({ title: "Employee updated" });
        onSaved?.();
        onOpenChange(false);
        return;
      }
      const err = data?.error as PatchError | undefined;
      if (res.status === 403) {
        toast({ title: "You do not have access", variant: "destructive" });
        setError("You do not have access.");
        return;
      }
      if (res.status === 404) {
        toast({ title: "Employee not found", variant: "destructive" });
        setError("Employee not found (maybe moved org).");
        return;
      }
      const details = Array.isArray(err?.details) ? err.details.join(". ") : "";
      const msg = details || err?.code || data?.error || "Update failed";
      toast({ title: msg, variant: "destructive" });
      setError(details || msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit employee</SheetTitle>
          <SheetDescription>
            Update basic details. Changes are saved to the current organization.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {error && (
            <p className="text-sm text-destructive font-medium" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="edit-first-name">First name</Label>
            <Input
              id="edit-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-last-name">Last name</Label>
            <Input
              id="edit-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-employee-number">Employee number</Label>
            <Input
              id="edit-employee-number"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="Employee number"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-title">Title</Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-hire-date">Hire date</Label>
            <Input
              id="edit-hire-date"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              className="bg-background"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="employee-edit-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
