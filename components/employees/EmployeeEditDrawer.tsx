"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { isSafeAppReturnTo, normDate } from "@/lib/utils";

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
    dateOfBirth?: string;
    siteId?: string | null;
    orgUnitId?: string | null;
    team?: string;
    managerId?: string | null;
  } | null;
  /** When set, after successful save close drawer and redirect here (only /app/ paths). */
  returnTo?: string;
  onSaved?: () => void;
};

type PatchError = { code?: string; details?: string[] };

type SectionMedical = { valid_to: string; valid_from: string };
type SectionTraining = { valid_to: string; completed_on: string };
type SectionCertificate = { valid_to: string; issued_on: string };

export function EmployeeEditDrawer({
  open,
  onOpenChange,
  employeeId,
  initial,
  returnTo,
  onSaved,
}: EmployeeEditDrawerProps) {
  const { toast } = useToast();
  const router = useRouter();

  const closeAndMaybeRedirect = useCallback(() => {
    onSaved?.();
    onOpenChange(false);
    if (returnTo && isSafeAppReturnTo(returnTo)) {
      router.push(returnTo);
    }
  }, [onSaved, onOpenChange, returnTo, router]);

  // Draft state (all sections)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [title, setTitle] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [employmentType, setEmploymentType] = useState<"permanent" | "temporary" | "consultant">("permanent");
  const [contractEndDate, setContractEndDate] = useState("");
  const [medicalValidTo, setMedicalValidTo] = useState("");
  const [medicalValidFrom, setMedicalValidFrom] = useState("");
  const [trainingValidTo, setTrainingValidTo] = useState("");
  const [trainingCompletedOn, setTrainingCompletedOn] = useState("");
  const [certificateValidTo, setCertificateValidTo] = useState("");
  const [certificateIssuedOn, setCertificateIssuedOn] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [siteId, setSiteId] = useState<string | null>(null);
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null);
  const [team, setTeam] = useState("");
  const [managerId, setManagerId] = useState<string | null>(null);

  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  const [orgUnits, setOrgUnits] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [managers, setManagers] = useState<{ id: string; name: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial snapshots (set when drawer opens + fetch completes) for dirty detection
  const [initialMedical, setInitialMedical] = useState<SectionMedical | null>(null);
  const [initialTraining, setInitialTraining] = useState<SectionTraining | null>(null);
  const [initialCertificate, setInitialCertificate] = useState<SectionCertificate | null>(null);

  const resetEmploymentForm = useCallback(() => {
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
    setDateOfBirth(initial?.dateOfBirth ?? "");
    setSiteId(initial?.siteId ?? null);
    setOrgUnitId(initial?.orgUnitId ?? null);
    setTeam(initial?.team ?? "");
    setManagerId(initial?.managerId ?? null);
    setError(null);
  }, [initial]);

  useEffect(() => {
    if (open) resetEmploymentForm();
  }, [open, resetEmploymentForm]);

  // On open: fetch sites, org units, managers (for master section)
  useEffect(() => {
    if (!open) return;
    const headers = withDevBearer();
    Promise.all([
      fetch("/api/sites", { credentials: "include", headers }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/org-units", { credentials: "include", headers }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/employees/min", { credentials: "include", headers }).then((r) => (r.ok ? r.json() : null)),
    ]).then(([sitesRes, orgUnitsRes, employeesRes]) => {
      setSites(sitesRes?.sites ?? []);
      setOrgUnits(orgUnitsRes?.org_units ?? []);
      const list = Array.isArray(employeesRes?.employees) ? employeesRes.employees : [];
      setManagers(list.map((e: { id: string; name?: string }) => ({ id: e.id, name: e.name ?? "" })));
    });
  }, [open]);

  // On open: fetch medical, training, certificate and set initial + draft
  useEffect(() => {
    if (!open || !employeeId) return;
    setInitialMedical(null);
    setInitialTraining(null);
    setInitialCertificate(null);
    const headers = withDevBearer();
    Promise.all([
      fetch(`/api/employees/${employeeId}/medical`, { credentials: "include", headers }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/employees/${employeeId}/training`, { credentials: "include", headers }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch(`/api/employees/${employeeId}/certificate`, { credentials: "include", headers }).then((r) =>
        r.ok ? r.json() : null
      ),
    ]).then(([med, train, cert]) => {
      const m: SectionMedical = {
        valid_to: med?.ok && med.valid_to ? String(med.valid_to).slice(0, 10) : "",
        valid_from: med?.ok && med.valid_from ? String(med.valid_from).slice(0, 10) : "",
      };
      const t: SectionTraining = {
        valid_to: train?.ok && train.valid_to ? String(train.valid_to).slice(0, 10) : "",
        completed_on: train?.ok && train.completed_on ? String(train.completed_on).slice(0, 10) : "",
      };
      const c: SectionCertificate = {
        valid_to: cert?.ok && cert.valid_to ? String(cert.valid_to).slice(0, 10) : "",
        issued_on: cert?.ok && cert.issued_on ? String(cert.issued_on).slice(0, 10) : "",
      };
      setInitialMedical(m);
      setInitialTraining(t);
      setInitialCertificate(c);
      setMedicalValidTo(m.valid_to);
      setMedicalValidFrom(m.valid_from);
      setTrainingValidTo(t.valid_to);
      setTrainingCompletedOn(t.completed_on);
      setCertificateValidTo(c.valid_to);
      setCertificateIssuedOn(c.issued_on);
    });
  }, [open, employeeId]);

  // Dirty detection (including master fields; use normDate for DOB)
  const employmentDirty = useMemo(() => {
    const a = initial?.firstName ?? "";
    const b = initial?.lastName ?? "";
    const c = initial?.employeeNumber ?? "";
    const d = initial?.email ?? "";
    const e = initial?.phone ?? "";
    const f = initial?.title ?? "";
    const g = initial?.hireDate ?? "";
    const et = initial?.employmentType ?? "permanent";
    const h = et === "permanent" ? "" : (initial?.contractEndDate ?? "");
    const dob = normDate(initial?.dateOfBirth ?? "");
    const sid = initial?.siteId ?? null;
    const oid = initial?.orgUnitId ?? null;
    const t = initial?.team ?? "";
    const mid = initial?.managerId ?? null;
    return (
      firstName.trim() !== a ||
      lastName.trim() !== b ||
      employeeNumber.trim() !== c ||
      (email ?? "").trim() !== d ||
      (phone ?? "").trim() !== e ||
      (title ?? "").trim() !== f ||
      (hireDate ?? "").trim() !== g ||
      employmentType !== et ||
      (employmentType === "permanent" ? "" : (contractEndDate ?? "").trim()) !== h ||
      normDate(dateOfBirth) !== dob ||
      (siteId ?? null) !== sid ||
      (orgUnitId ?? null) !== oid ||
      (team ?? "").trim() !== t ||
      (managerId ?? null) !== mid
    );
  }, [
    initial,
    firstName,
    lastName,
    employeeNumber,
    email,
    phone,
    title,
    hireDate,
    employmentType,
    contractEndDate,
    dateOfBirth,
    siteId,
    orgUnitId,
    team,
    managerId,
  ]);

  const medicalDirty = useMemo(() => {
    if (initialMedical == null) return false;
    return (
      normDate(medicalValidTo) !== normDate(initialMedical.valid_to) ||
      normDate(medicalValidFrom) !== normDate(initialMedical.valid_from)
    );
  }, [initialMedical, medicalValidTo, medicalValidFrom]);

  const trainingDirty = useMemo(() => {
    if (initialTraining == null) return false;
    return (
      normDate(trainingValidTo) !== normDate(initialTraining.valid_to) ||
      normDate(trainingCompletedOn) !== normDate(initialTraining.completed_on)
    );
  }, [initialTraining, trainingValidTo, trainingCompletedOn]);

  const certificateDirty = useMemo(() => {
    if (initialCertificate == null) return false;
    return (
      normDate(certificateValidTo) !== normDate(initialCertificate.valid_to) ||
      normDate(certificateIssuedOn) !== normDate(initialCertificate.issued_on)
    );
  }, [initialCertificate, certificateValidTo, certificateIssuedOn]);

  const anyDirty = employmentDirty || medicalDirty || trainingDirty || certificateDirty;

  const handleSaveAll = async () => {
    if (!employeeId) return;
    setError(null);
    const needsContractEnd = employmentType === "temporary" || employmentType === "consultant";
    if (needsContractEnd && !contractEndDate.trim()) {
      setError("Contract end date is required for Visstid and Provanställd.");
      toast({ title: "Contract end date required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const order: Array<"employment" | "medical" | "training" | "certificate"> = [
        "employment",
        "medical",
        "training",
        "certificate",
      ];
      for (const section of order) {
        if (section === "employment" && employmentDirty) {
          const body: Record<string, unknown> = {
            first_name: firstName.trim() || undefined,
            last_name: lastName.trim() || undefined,
            employee_number: employeeNumber.trim() || undefined,
            email: email.trim() || null,
            phone: phone.trim() || null,
            role: title.trim() || null,
            hire_date: hireDate.trim() || undefined,
            employment_type: employmentType,
            contract_end_date: employmentType === "permanent" ? null : (contractEndDate.trim() || null),
            date_of_birth: dateOfBirth.trim() ? dateOfBirth.trim() : null,
            site_id: siteId && siteId.trim() ? siteId : null,
            org_unit_id: orgUnitId && orgUnitId.trim() ? orgUnitId : null,
            manager_id: managerId && managerId.trim() ? managerId : null,
            team: team.trim() ? team.trim() : null,
          };
          const res = await fetch(`/api/employees/${employeeId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...withDevBearer() },
            credentials: "include",
            body: JSON.stringify(body),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            const err = data?.error as PatchError | undefined;
            if (res.status === 403) {
              toast({ title: "You do not have access", variant: "destructive" });
            } else if (res.status === 404) {
              toast({ title: "Employee not found", variant: "destructive" });
            } else {
              const msg = Array.isArray(err?.details) ? err.details.join(". ") : err?.code ?? data?.error ?? "Update failed";
              toast({ title: msg, variant: "destructive" });
            }
            setError("Save failed");
            return;
          }
        }
        if (section === "medical" && medicalDirty) {
          const res = await fetch(`/api/employees/${employeeId}/medical`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...withDevBearer() },
            credentials: "include",
            body: JSON.stringify({
              medical_type: "GENERAL",
              valid_to: medicalValidTo.trim() || null,
              valid_from: medicalValidFrom.trim() || null,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.ok) {
            const msg = data?.error?.message ?? data?.error ?? "Failed to save medical";
            toast({ title: typeof msg === "string" ? msg : "Failed to save medical", variant: "destructive" });
            setError("Save failed");
            return;
          }
        }
        if (section === "training" && trainingDirty) {
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
          if (!res.ok || !data.ok) {
            const msg = data?.error?.message ?? data?.error ?? "Failed to save training";
            toast({ title: typeof msg === "string" ? msg : "Failed to save training", variant: "destructive" });
            setError("Save failed");
            return;
          }
        }
        if (section === "certificate" && certificateDirty) {
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
          if (!res.ok || !data.ok) {
            const msg = data?.error?.message ?? data?.error ?? "Failed to save certificate";
            toast({ title: typeof msg === "string" ? msg : "Failed to save certificate", variant: "destructive" });
            setError("Save failed");
            return;
          }
        }
      }
      toast({ title: "Saved" });
      closeAndMaybeRedirect();
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
          <div className="border-b border-border pb-4 space-y-3">
            <Label className="text-sm font-medium">Employee master</Label>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-dob">Date of birth</Label>
                <Input
                  id="edit-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-site">Site</Label>
                <Select
                  value={siteId ?? ""}
                  onValueChange={(v) => setSiteId(v === "" ? null : v)}
                >
                  <SelectTrigger id="edit-site" className="bg-background">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-org-unit">Org unit</Label>
                <Select
                  value={orgUnitId ?? ""}
                  onValueChange={(v) => setOrgUnitId(v === "" ? null : v)}
                >
                  <SelectTrigger id="edit-org-unit" className="bg-background">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {orgUnits.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-team">Team</Label>
                <Input
                  id="edit-team"
                  value={team}
                  onChange={(e) => setTeam(e.target.value)}
                  placeholder="Team"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-manager">Manager</Label>
                <Select
                  value={managerId ?? ""}
                  onValueChange={(v) => setManagerId(v === "" ? null : v)}
                >
                  <SelectTrigger id="edit-manager" className="bg-background">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">—</SelectItem>
                    {managers
                      .filter((m) => m.id !== employeeId)
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-role-title">Role/Title</Label>
                <Input
                  id="edit-role-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Role/Title"
                  className="bg-background"
                />
              </div>
            </div>
          </div>
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
            <div className="space-y-2">
              <Label htmlFor="edit-medical-valid-from">Valid from (optional)</Label>
              <Input
                id="edit-medical-valid-from"
                type="date"
                value={medicalValidFrom}
                onChange={(e) => setMedicalValidFrom(e.target.value)}
                className="bg-background"
              />
            </div>
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
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <Label className="text-sm font-medium">Training</Label>
            <p className="text-xs text-muted-foreground">SAFETY training validity.</p>
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
          </div>
          <div className="border-t border-border pt-4 space-y-2">
            <Label className="text-sm font-medium">Certificate</Label>
            <p className="text-xs text-muted-foreground">FORKLIFT certificate validity.</p>
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
          </div>
        </div>
        <div className="flex-shrink-0 border-t bg-background px-6 py-4 flex flex-col gap-2">
          {anyDirty && (
            <p className="text-xs text-muted-foreground" data-testid="employee-edit-unsaved-hint">
              Unsaved changes
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={saving || !anyDirty}
              data-testid="employee-edit-save"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
