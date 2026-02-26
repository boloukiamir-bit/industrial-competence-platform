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

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "permanent" as const, label: "Permanent" },
  { value: "temporary" as const, label: "Visstid" },
  { value: "consultant" as const, label: "Provanställd" },
] as const;

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
    employmentType?: "permanent" | "temporary" | "consultant";
    contractEndDate?: string;
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
  const [employmentType, setEmploymentType] = useState<"permanent" | "temporary" | "consultant">("permanent");
  const [contractEndDate, setContractEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [medicalValidTo, setMedicalValidTo] = useState("");
  const [medicalSaving, setMedicalSaving] = useState(false);
  const [medicalError, setMedicalError] = useState<string | null>(null);
  const [trainingValidTo, setTrainingValidTo] = useState("");
  const [trainingCompletedOn, setTrainingCompletedOn] = useState("");
  const [trainingSaving, setTrainingSaving] = useState(false);
  const [trainingError, setTrainingError] = useState<string | null>(null);
  const [certificateValidTo, setCertificateValidTo] = useState("");
  const [certificateIssuedOn, setCertificateIssuedOn] = useState("");
  const [certificateSaving, setCertificateSaving] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setFirstName(initial?.firstName ?? "");
    setLastName(initial?.lastName ?? "");
    setEmployeeNumber(initial?.employeeNumber ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setTitle(initial?.title ?? "");
    setHireDate(initial?.hireDate ?? "");
    const et = initial?.employmentType ?? "permanent";
    setEmploymentType(et);
    setContractEndDate(et === "permanent" ? "" : (initial?.contractEndDate ?? ""));
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (open) resetForm();
  }, [open, resetForm]);

  useEffect(() => {
    if (!open || !employeeId) return;
    setMedicalError(null);
    fetch(`/api/employees/${employeeId}/medical`, { credentials: "include", headers: withDevBearer() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok && json.valid_to) setMedicalValidTo(String(json.valid_to).slice(0, 10));
        else setMedicalValidTo("");
      })
      .catch(() => setMedicalValidTo(""));
  }, [open, employeeId]);

  useEffect(() => {
    if (!open || !employeeId) return;
    setTrainingError(null);
    fetch(`/api/employees/${employeeId}/training`, { credentials: "include", headers: withDevBearer() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok) {
          setTrainingValidTo(json.valid_to ? String(json.valid_to).slice(0, 10) : "");
          setTrainingCompletedOn(json.completed_on ? String(json.completed_on).slice(0, 10) : "");
        } else {
          setTrainingValidTo("");
          setTrainingCompletedOn("");
        }
      })
      .catch(() => {
        setTrainingValidTo("");
        setTrainingCompletedOn("");
      });
  }, [open, employeeId]);

  useEffect(() => {
    if (!open || !employeeId) return;
    setCertificateError(null);
    fetch(`/api/employees/${employeeId}/certificate`, { credentials: "include", headers: withDevBearer() })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json?.ok) {
          setCertificateValidTo(json.valid_to ? String(json.valid_to).slice(0, 10) : "");
          setCertificateIssuedOn(json.issued_on ? String(json.issued_on).slice(0, 10) : "");
        } else {
          setCertificateValidTo("");
          setCertificateIssuedOn("");
        }
      })
      .catch(() => {
        setCertificateValidTo("");
        setCertificateIssuedOn("");
      });
  }, [open, employeeId]);

  const handleSave = async () => {
    if (!employeeId) return;
    setError(null);
    const needsContractEnd = employmentType === "temporary" || employmentType === "consultant";
    if (needsContractEnd && !contractEndDate.trim()) {
      setError("Contract end date is required for Visstid and Provanställd.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        employee_number: employeeNumber.trim() || undefined,
        email: email.trim() || null,
        phone: phone.trim() || null,
        title: title.trim() || null,
        hire_date: hireDate.trim() || undefined,
        employment_type: employmentType,
        contract_end_date: employmentType === "permanent" ? null : (contractEndDate.trim() || null),
      };
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...withDevBearer() },
        credentials: "include",
        body: JSON.stringify(body),
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
      <SheetContent className="sm:max-w-md flex flex-col h-full max-h-[100vh] overflow-hidden p-0">
        <SheetHeader className="flex-shrink-0 px-6 pt-6 pr-12 pb-2 text-left">
          <SheetTitle>Edit employee</SheetTitle>
          <SheetDescription>
            Update basic details. Changes are saved to the current organization.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-8 space-y-4">
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
          <div className="space-y-2">
            <Label htmlFor="edit-employment-type">Employment type</Label>
            <Select
              value={employmentType}
              onValueChange={(value: "permanent" | "temporary" | "consultant") => {
                setEmploymentType(value);
                if (value === "permanent") setContractEndDate("");
              }}
            >
              <SelectTrigger id="edit-employment-type" className="bg-background" data-testid="edit-employment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(employmentType === "temporary" || employmentType === "consultant") && (
            <div className="space-y-2">
              <Label htmlFor="edit-contract-end-date">Contract end date</Label>
              <Input
                id="edit-contract-end-date"
                type="date"
                value={contractEndDate}
                onChange={(e) => setContractEndDate(e.target.value)}
                className="bg-background"
                data-testid="edit-contract-end-date"
              />
            </div>
          )}
          <div className="border-t border-border pt-4 space-y-2">
            <Label className="text-sm font-medium">Medical</Label>
            <p className="text-xs text-muted-foreground">General medical check validity.</p>
            {medicalError && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {medicalError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-medical-valid-to">Valid to</Label>
              <Input
                id="edit-medical-valid-to"
                type="date"
                value={medicalValidTo}
                onChange={(e) => setMedicalValidTo(e.target.value)}
                className="bg-background"
                data-testid="edit-medical-valid-to"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={medicalSaving}
              data-testid="employee-edit-save-medical"
              onClick={async () => {
                if (!employeeId) return;
                setMedicalError(null);
                setMedicalSaving(true);
                try {
                  const res = await fetch(`/api/employees/${employeeId}/medical`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...withDevBearer() },
                    credentials: "include",
                    body: JSON.stringify({
                      medical_type: "GENERAL",
                      valid_to: medicalValidTo.trim() || null,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.ok) {
                    toast({ title: "Medical updated" });
                    onSaved?.();
                  } else {
                    const msg = data?.error?.message ?? data?.error ?? "Failed to save medical";
                    setMedicalError(typeof msg === "string" ? msg : "Failed to save medical");
                  }
                } finally {
                  setMedicalSaving(false);
                }
              }}
            >
              {medicalSaving ? "Saving…" : "Save medical"}
            </Button>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <Label className="text-sm font-medium">Training</Label>
            <p className="text-xs text-muted-foreground">SAFETY training validity.</p>
            {trainingError && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {trainingError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-training-valid-to">Valid to</Label>
              <Input
                id="edit-training-valid-to"
                type="date"
                value={trainingValidTo}
                onChange={(e) => setTrainingValidTo(e.target.value)}
                className="bg-background"
                data-testid="edit-training-valid-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-training-completed-on">Completed on (optional)</Label>
              <Input
                id="edit-training-completed-on"
                type="date"
                value={trainingCompletedOn}
                onChange={(e) => setTrainingCompletedOn(e.target.value)}
                className="bg-background"
                data-testid="edit-training-completed-on"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={trainingSaving}
              data-testid="employee-edit-save-training"
              onClick={async () => {
                if (!employeeId) return;
                setTrainingError(null);
                setTrainingSaving(true);
                try {
                  const res = await fetch(`/api/employees/${employeeId}/training`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...withDevBearer() },
                    credentials: "include",
                    body: JSON.stringify({
                      training_code: "SAFETY",
                      valid_to: trainingValidTo.trim() || null,
                      completed_on: trainingCompletedOn.trim() || null,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.ok) {
                    toast({ title: "Training updated" });
                    onSaved?.();
                  } else {
                    const msg = data?.error?.message ?? data?.error ?? "Failed to save training";
                    setTrainingError(typeof msg === "string" ? msg : "Failed to save training");
                  }
                } finally {
                  setTrainingSaving(false);
                }
              }}
            >
              {trainingSaving ? "Saving…" : "Save training"}
            </Button>
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <Label className="text-sm font-medium">Certificate</Label>
            <p className="text-xs text-muted-foreground">FORKLIFT certificate validity.</p>
            {certificateError && (
              <p className="text-sm text-destructive font-medium" role="alert">
                {certificateError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="edit-certificate-valid-to">Valid to</Label>
              <Input
                id="edit-certificate-valid-to"
                type="date"
                value={certificateValidTo}
                onChange={(e) => setCertificateValidTo(e.target.value)}
                className="bg-background"
                data-testid="edit-certificate-valid-to"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-certificate-issued-on">Issued on (optional)</Label>
              <Input
                id="edit-certificate-issued-on"
                type="date"
                value={certificateIssuedOn}
                onChange={(e) => setCertificateIssuedOn(e.target.value)}
                className="bg-background"
                data-testid="edit-certificate-issued-on"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={certificateSaving}
              data-testid="employee-edit-save-certificate"
              onClick={async () => {
                if (!employeeId) return;
                setCertificateError(null);
                setCertificateSaving(true);
                try {
                  const res = await fetch(`/api/employees/${employeeId}/certificate`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json", ...withDevBearer() },
                    credentials: "include",
                    body: JSON.stringify({
                      certificate_code: "FORKLIFT",
                      valid_to: certificateValidTo.trim() || null,
                      issued_on: certificateIssuedOn.trim() || null,
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data.ok) {
                    toast({ title: "Certificate updated" });
                    onSaved?.();
                  } else {
                    const msg = data?.error?.message ?? data?.error ?? "Failed to save certificate";
                    setCertificateError(typeof msg === "string" ? msg : "Failed to save certificate");
                  }
                } finally {
                  setCertificateSaving(false);
                }
              }}
            >
              {certificateSaving ? "Saving…" : "Save certificate"}
            </Button>
          </div>
        </div>
        <div className="flex-shrink-0 border-t bg-background px-6 py-4 flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} data-testid="employee-edit-save">
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
