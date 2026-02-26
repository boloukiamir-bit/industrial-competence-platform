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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { withDevBearer } from "@/lib/devBearer";

export type EmployeeCreateDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (newEmployeeId: string) => void;
};

export function EmployeeCreateDrawer({
  open,
  onOpenChange,
  onSaved,
}: EmployeeCreateDrawerProps) {
  const { toast } = useToast();
  const [employmentExternalId, setEmploymentExternalId] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<string>("ACTIVE");
  const [employmentForm, setEmploymentForm] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [terminationDate, setTerminationDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setEmploymentExternalId("");
    setEmployeeNumber("");
    setFirstName("");
    setLastName("");
    setEmploymentStatus("ACTIVE");
    setEmploymentForm("");
    setContractStartDate("");
    setContractEndDate("");
    setEmail("");
    setPhone("");
    setTitle("");
    setTerminationDate("");
    setError(null);
  }, []);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  const handleSave = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setError("First name and last name are required.");
      return;
    }
    if (employmentStatus === "TERMINATED" && !terminationDate.trim()) {
      setError("Termination date is required when status is TERMINATED.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        credentials: "include",
        body: JSON.stringify({
          first_name: fn,
          last_name: ln,
          employment_external_id: employmentExternalId.trim() || undefined,
          employee_number: employeeNumber.trim() || undefined,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          title: title.trim() || undefined,
          employment_form: employmentForm.trim() || undefined,
          contract_start_date: contractStartDate.trim() || undefined,
          contract_end_date: contractEndDate.trim() || undefined,
          employment_status: employmentStatus as "ACTIVE" | "INACTIVE" | "TERMINATED",
          termination_date: employmentStatus === "TERMINATED" ? terminationDate.trim() || undefined : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.employee) {
        toast({ title: "Employee created" });
        const newId = (data.employee as { id?: string }).id;
        onSaved?.(newId ?? "");
        onOpenChange(false);
        return;
      }
      if (res.status === 403) {
        toast({ title: "You do not have access", variant: "destructive" });
        setError("You do not have access.");
        return;
      }
      const details = Array.isArray(data?.details) ? data.details.join(". ") : "";
      const msg = details || data?.error || "Create failed";
      toast({ title: msg, variant: "destructive" });
      setError(details || msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add employee</SheetTitle>
          <SheetDescription>
            Create an employee in the current organization. Required: first name, last name.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {error && (
            <p className="text-sm text-destructive font-medium" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="create-external-id">External ID (Anst.id)</Label>
            <Input
              id="create-external-id"
              value={employmentExternalId}
              onChange={(e) => setEmploymentExternalId(e.target.value)}
              placeholder="e.g. 45"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-employee-number">Employee number</Label>
            <Input
              id="create-employee-number"
              value={employeeNumber}
              onChange={(e) => setEmployeeNumber(e.target.value)}
              placeholder="Omit to use External ID"
              className="bg-background"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-first-name">First name *</Label>
              <Input
                id="create-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-last-name">Last name *</Label>
              <Input
                id="create-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-status">Status</Label>
            <Select value={employmentStatus} onValueChange={setEmploymentStatus}>
              <SelectTrigger id="create-status" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                <SelectItem value="INACTIVE">INACTIVE</SelectItem>
                <SelectItem value="TERMINATED">TERMINATED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {employmentStatus === "TERMINATED" && (
            <div className="space-y-2">
              <Label htmlFor="create-termination-date">Termination date *</Label>
              <Input
                id="create-termination-date"
                type="date"
                value={terminationDate}
                onChange={(e) => setTerminationDate(e.target.value)}
                className="bg-background"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="create-employment-form">Employment form</Label>
            <Input
              id="create-employment-form"
              value={employmentForm}
              onChange={(e) => setEmploymentForm(e.target.value)}
              placeholder="e.g. Visstid - Överenskommen"
              className="bg-background"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="create-contract-start">Contract start</Label>
              <Input
                id="create-contract-start"
                type="date"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
                className="bg-background"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-contract-end">Contract end</Label>
              <Input
                id="create-contract-end"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className="bg-background"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-email">Email</Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-phone">Phone</Label>
            <Input
              id="create-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className="bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-title">Title</Label>
            <Input
              id="create-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title / role"
              className="bg-background"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="employee-create-save">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
