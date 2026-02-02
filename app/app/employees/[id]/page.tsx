"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { withDevBearer } from "@/lib/devBearer";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  ArrowLeft,
  FileText,
  Package,
  AlertTriangle,
  Star,
  Banknote,
  Plus,
  Download,
  Shield,
  MessageSquare,
  Building2,
  Image,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  Employee,
  EmployeeSkill,
  PersonEvent,
  Document,
  EmployeeEquipment,
  EmployeeReview,
  SalaryRecord,
  SalaryRevision,
  OneToOneMeeting,
} from "@/types/domain";
import { logEmployeeAccess } from "@/services/gdpr";

type TabId = "personal" | "contact" | "organisation" | "employment" | "compensation" | "competence" | "compliance" | "profile" | "one-to-ones" | "documents" | "events" | "equipment";

export type EmployeeProfileRow = {
  photoUrl: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  notes: string | null;
  siteId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type EmployeeData = {
  employee: Employee | null;
  skills: EmployeeSkill[];
  events: PersonEvent[];
  documents: Document[];
  equipment: EmployeeEquipment[];
  reviews: EmployeeReview[];
  currentSalary: SalaryRecord | null;
  salaryRevisions: SalaryRevision[];
  meetings: OneToOneMeeting[];
  employeeProfile: EmployeeProfileRow;
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3" data-testid={`info-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

const EMPTY_EMPLOYEE_PROFILE: EmployeeProfileRow = {
  photoUrl: null,
  bio: null,
  address: null,
  city: null,
  postalCode: null,
  country: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  emergencyContactRelation: null,
  notes: null,
};

export default function EmployeeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<EmployeeData>({
    employee: null,
    skills: [],
    events: [],
    documents: [],
    equipment: [],
    reviews: [],
    currentSalary: null,
    salaryRevisions: [],
    meetings: [],
    employeeProfile: EMPTY_EMPLOYEE_PROFILE,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("personal");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileForm, setProfileForm] = useState<EmployeeProfileRow>(EMPTY_EMPLOYEE_PROFILE);
  type ComplianceItem = { category: string; name: string; status: string; valid_to: string | null; days_left: number | null };
  const [complianceItems, setComplianceItems] = useState<ComplianceItem[]>([]);
  const [complianceLoading, setComplianceLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) {
        setLoading(false);
        return;
      }
      // Tenant-scoped employee from API (session active_org_id)
      const employeeRes = await fetch(`/api/employees/${id}`, { credentials: "include" });
      const employeeJson = employeeRes.ok ? await employeeRes.json().catch(() => null) : null;
      const empFromApi = employeeJson && employeeRes.ok
        ? {
            id: employeeJson.id,
            name: employeeJson.name ?? "",
            firstName: employeeJson.firstName,
            lastName: employeeJson.lastName,
            employeeNumber: employeeJson.employeeNumber ?? "",
            email: employeeJson.email,
            phone: employeeJson.phone,
            dateOfBirth: employeeJson.dateOfBirth,
            role: employeeJson.role ?? "",
            line: employeeJson.line ?? "",
            team: employeeJson.team ?? "",
            employmentType: (employeeJson.employmentType ?? "permanent") as "permanent" | "temporary" | "consultant",
            startDate: employeeJson.startDate,
            contractEndDate: employeeJson.contractEndDate,
            managerId: employeeJson.managerId,
            managerName: employeeJson.managerName,
            address: employeeJson.address,
            city: employeeJson.city,
            postalCode: employeeJson.postalCode,
            country: employeeJson.country ?? "Sweden",
            isActive: employeeJson.isActive ?? true,
          }
        : null;

      if (!empFromApi) {
        setData({
          employee: null,
          skills: [],
          events: [],
          documents: [],
          equipment: [],
          reviews: [],
          currentSalary: null,
          salaryRevisions: [],
          meetings: [],
          employeeProfile: EMPTY_EMPLOYEE_PROFILE,
        });
        setLoading(false);
        return;
      }

      if (employeeRes.ok) {
        try {
          await logEmployeeAccess(id, "view_profile");
        } catch (e) {
          console.error("Error logging access:", e);
        }
      }

      const profileRes = await fetch(`/api/employees/${id}/profile`, { credentials: "include" });
      const profileJson = profileRes.ok ? await profileRes.json().catch(() => null) : null;
      const profile = profileJson ?? {
        skills: [],
        events: [],
        documents: [],
        equipment: [],
        reviews: [],
        currentSalary: null,
        salaryRevisions: [],
        meetings: [],
        employeeProfile: {},
      };
      const ep = profile.employeeProfile && typeof profile.employeeProfile === "object"
        ? {
            photoUrl: profile.employeeProfile.photoUrl ?? null,
            bio: profile.employeeProfile.bio ?? null,
            address: profile.employeeProfile.address ?? null,
            city: profile.employeeProfile.city ?? null,
            postalCode: profile.employeeProfile.postalCode ?? null,
            country: profile.employeeProfile.country ?? null,
            emergencyContactName: profile.employeeProfile.emergencyContactName ?? null,
            emergencyContactPhone: profile.employeeProfile.emergencyContactPhone ?? null,
            emergencyContactRelation: profile.employeeProfile.emergencyContactRelation ?? null,
            notes: profile.employeeProfile.notes ?? null,
            siteId: profile.employeeProfile.siteId ?? null,
            createdAt: profile.employeeProfile.createdAt,
            updatedAt: profile.employeeProfile.updatedAt,
          }
        : EMPTY_EMPLOYEE_PROFILE;

      setData({
        employee: empFromApi,
        skills: profile.skills ?? [],
        events: profile.events ?? [],
        documents: profile.documents ?? [],
        equipment: profile.equipment ?? [],
        reviews: profile.reviews ?? [],
        currentSalary: profile.currentSalary ?? null,
        salaryRevisions: profile.salaryRevisions ?? [],
        meetings: profile.meetings ?? [],
        employeeProfile: ep,
      });
      setProfileForm(ep);
      setLoading(false);
    }
    if (id) loadData();
  }, [id]);

  const loadCompliance = useCallback(async () => {
    if (!id) return;
    setComplianceLoading(true);
    try {
      const res = await fetch(`/api/compliance/employee?employeeId=${encodeURIComponent(id)}`, {
        credentials: "include",
        headers: withDevBearer(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok && Array.isArray(json.items)) {
        setComplianceItems(
          json.items.map((i: { category: string; name: string; status: string; valid_to: string | null; days_left: number | null }) => ({
            category: i.category,
            name: i.name,
            status: i.status,
            valid_to: i.valid_to ?? null,
            days_left: i.days_left ?? null,
          }))
        );
      } else {
        setComplianceItems([]);
      }
    } catch {
      setComplianceItems([]);
    } finally {
      setComplianceLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "compliance" && id) {
      loadCompliance();
    }
  }, [activeTab, id, loadCompliance]);

  useEffect(() => {
    if (activeTab === "profile" && data.employeeProfile) {
      setProfileForm(data.employeeProfile);
    }
  }, [activeTab, data.employeeProfile]);

  async function handleExportData() {
    const response = await fetch(`/api/gdpr/export-employee-data?employee_id=${id}`);
    const exportData = await response.json();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `employee-data-${data.employee?.employeeNumber || id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!data.employee) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Employee not found</p>
        <Link href="/app/employees" className="text-primary hover:underline mt-2 inline-block">
          Back to employees
        </Link>
      </div>
    );
  }

  const { employee, skills, events, documents, equipment, reviews, currentSalary, salaryRevisions, meetings, employeeProfile } = data;

  const navItems: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "personal", label: "Personal Data", icon: User },
    { id: "contact", label: "Contact Information", icon: Mail },
    { id: "profile", label: "Edit profile", icon: Image },
    { id: "organisation", label: "Organisation", icon: Building2 },
    { id: "employment", label: "Job & Employment", icon: Briefcase },
    { id: "compensation", label: "Compensation", icon: Banknote },
    { id: "competence", label: "Competence", icon: Star, count: skills.length },
    { id: "compliance", label: "Compliance", icon: ClipboardCheck },
    { id: "one-to-ones", label: "1:1 / Medarbetarsamtal", icon: MessageSquare, count: meetings.length },
    { id: "documents", label: "Documents", icon: FileText, count: documents.length },
    { id: "events", label: "People Risk & Tasks", icon: AlertTriangle, count: events.filter((e) => e.status !== "completed").length },
    { id: "equipment", label: "Equipment", icon: Package, count: equipment.length },
  ];

  const levelLabels = ["Not trained", "In training", "Can assist", "Trained", "Can train others"];

  const categoryLabels: Record<string, string> = {
    contract: "Contract",
    medical_check: "Medical Check",
    training: "Training",
    onboarding: "Onboarding",
    offboarding: "Offboarding",
    work_env_delegation: "Work Env Delegation",
    equipment: "Equipment",
  };

  const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    upcoming: "outline",
    due_soon: "default",
    overdue: "destructive",
    completed: "secondary",
  };

  return (
    <div className="flex h-full">
      <aside className="w-64 border-r bg-muted/30 p-4 flex flex-col">
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/app/employees")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
        
        <div className="mb-6 px-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold" data-testid="text-employee-name">{employee.name}</h2>
              <p className="text-sm text-muted-foreground">{employee.role || "No role"}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-1">{employee.employeeNumber}</p>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-md transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover-elevate"
                }`}
                data-testid={`nav-${item.id}`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.count !== undefined && item.count > 0 && (
                  <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                    {item.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 pt-4 border-t">
          <Button variant="outline" size="sm" className="w-full" onClick={handleExportData} data-testid="button-export-gdpr">
            <Shield className="h-4 w-4 mr-2" />
            Export Data (GDPR)
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        {activeTab === "personal" && (
          <Card>
            <CardHeader>
              <CardTitle>Personal Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={User} label="Full Name" value={employee.name} />
                <InfoRow icon={User} label="First Name" value={employee.firstName || "-"} />
                <InfoRow icon={User} label="Last Name" value={employee.lastName || "-"} />
                <InfoRow icon={Calendar} label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString("sv-SE") : "-"} />
                <InfoRow icon={User} label="Employee Number" value={employee.employeeNumber} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "contact" && (
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={Mail} label="Email" value={employee.email || "-"} />
                <InfoRow icon={Phone} label="Phone" value={employee.phone || "-"} />
                <InfoRow icon={MapPin} label="Address" value={employee.address || "-"} />
                <InfoRow icon={MapPin} label="City" value={employee.city || "-"} />
                <InfoRow icon={MapPin} label="Postal Code" value={employee.postalCode || "-"} />
                <InfoRow icon={MapPin} label="Country" value={employee.country || "Sweden"} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "profile" && (
          <Card>
            <CardHeader>
              <CardTitle>Edit profile</CardTitle>
              <p className="text-sm text-muted-foreground">Photo, address, emergency contact, notes (upload later).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-photo_url">Photo URL</Label>
                  <Input
                    id="profile-photo_url"
                    value={profileForm.photoUrl ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, photoUrl: e.target.value || null }))}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <Textarea
                    id="profile-bio"
                    value={profileForm.bio ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, bio: e.target.value || null }))}
                    placeholder="Short bio"
                    rows={2}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-address">Address</Label>
                  <Input
                    id="profile-address"
                    value={profileForm.address ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value || null }))}
                    placeholder="Street address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-city">City</Label>
                  <Input
                    id="profile-city"
                    value={profileForm.city ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value || null }))}
                    placeholder="City"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-postal_code">Postal code</Label>
                  <Input
                    id="profile-postal_code"
                    value={profileForm.postalCode ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, postalCode: e.target.value || null }))}
                    placeholder="Postal code"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-country">Country</Label>
                  <Input
                    id="profile-country"
                    value={profileForm.country ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, country: e.target.value || null }))}
                    placeholder="Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-emergency_name">Emergency contact name</Label>
                  <Input
                    id="profile-emergency_name"
                    value={profileForm.emergencyContactName ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, emergencyContactName: e.target.value || null }))}
                    placeholder="Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-emergency_phone">Emergency contact phone</Label>
                  <Input
                    id="profile-emergency_phone"
                    value={profileForm.emergencyContactPhone ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, emergencyContactPhone: e.target.value || null }))}
                    placeholder="Phone"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-emergency_relation">Relation</Label>
                  <Input
                    id="profile-emergency_relation"
                    value={profileForm.emergencyContactRelation ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, emergencyContactRelation: e.target.value || null }))}
                    placeholder="e.g. Spouse, Parent"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="profile-notes">Notes</Label>
                  <Textarea
                    id="profile-notes"
                    value={profileForm.notes ?? ""}
                    onChange={(e) => setProfileForm((p) => ({ ...p, notes: e.target.value || null }))}
                    placeholder="Internal notes"
                    rows={3}
                  />
                </div>
              </div>
              <Button
                disabled={profileSaving}
                onClick={async () => {
                  setProfileSaving(true);
                  try {
                    const res = await fetch(`/api/employees/${id}/profile`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        photo_url: profileForm.photoUrl ?? null,
                        bio: profileForm.bio ?? null,
                        address: profileForm.address ?? null,
                        city: profileForm.city ?? null,
                        postal_code: profileForm.postalCode ?? null,
                        country: profileForm.country ?? null,
                        emergency_contact_name: profileForm.emergencyContactName ?? null,
                        emergency_contact_phone: profileForm.emergencyContactPhone ?? null,
                        emergency_contact_relation: profileForm.emergencyContactRelation ?? null,
                        notes: profileForm.notes ?? null,
                      }),
                      credentials: "include",
                    });
                    if (res.ok) {
                      setData((prev) => ({ ...prev, employeeProfile: { ...profileForm } }));
                    }
                  } finally {
                    setProfileSaving(false);
                  }
                }}
                data-testid="button-save-profile"
              >
                {profileSaving ? "Saving…" : "Save"}
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "organisation" && (
          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={Building2} label="Line" value={employee.line || "-"} />
                <InfoRow icon={Building2} label="Team" value={employee.team || "-"} />
                <InfoRow icon={User} label="Manager" value={employee.managerName || "-"} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "employment" && (
          <Card>
            <CardHeader>
              <CardTitle>Job & Employment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoRow icon={Briefcase} label="Role" value={employee.role || "-"} />
                <InfoRow icon={Briefcase} label="Employment Type" value={employee.employmentType} />
                <InfoRow icon={Calendar} label="Start Date" value={employee.startDate ? new Date(employee.startDate).toLocaleDateString("sv-SE") : "-"} />
                <InfoRow icon={Calendar} label="Contract End Date" value={employee.contractEndDate ? new Date(employee.contractEndDate).toLocaleDateString("sv-SE") : "-"} />
                <InfoRow icon={User} label="Status" value={employee.isActive ? "Active" : "Inactive"} />
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "compensation" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Current Salary</CardTitle>
                <Link href={`/app/employees/${id}/salary/new`}>
                  <Button size="sm" data-testid="button-new-salary">
                    <Plus className="h-4 w-4 mr-2" />
                    New Revision
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {currentSalary ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground">Amount</p>
                      <p className="text-2xl font-bold">{currentSalary.salaryAmountSek.toLocaleString("sv-SE")} SEK</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Type</p>
                      <p className="font-medium capitalize">{currentSalary.salaryType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Effective From</p>
                      <p className="font-medium">{new Date(currentSalary.effectiveFrom).toLocaleDateString("sv-SE")}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No salary record</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Salary History</CardTitle>
              </CardHeader>
              <CardContent>
                {salaryRevisions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No salary revisions</p>
                ) : (
                  <div className="space-y-3">
                    {salaryRevisions.map((rev) => (
                      <div key={rev.id} className="flex items-center justify-between p-3 border rounded-md">
                        <div>
                          <p className="font-medium">
                            {rev.previousSalarySek.toLocaleString("sv-SE")} → {rev.newSalarySek.toLocaleString("sv-SE")} SEK
                          </p>
                          <p className="text-sm text-muted-foreground">{rev.reason || "No reason"}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{new Date(rev.revisionDate).toLocaleDateString("sv-SE")}</p>
                          {rev.decidedByManagerName && (
                            <p className="text-xs text-muted-foreground">by {rev.decidedByManagerName}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "competence" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>Competence</CardTitle>
              <Link href={`/app/employees/${id}/competence`} className="hr-link" data-testid="link-competence-profile">
                Visa kompetensprofil →
              </Link>
            </CardHeader>
            <CardContent>
              {skills.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No competencies registered</p>
              ) : (
                <div className="space-y-3">
                  {skills.map((skill) => (
                    <div key={skill.skillId} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{skill.skillName || "Unknown"}</p>
                        <p className="text-sm text-muted-foreground">{skill.skillCategory || "Uncategorized"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {[0, 1, 2, 3, 4].map((l) => (
                            <div
                              key={l}
                              className={`w-3 h-3 rounded-full ${l <= skill.level ? "bg-primary" : "bg-muted"}`}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-muted-foreground w-24 text-right">
                          {levelLabels[skill.level]}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "compliance" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Compliance</h2>
              <Link href="/app/compliance">
                <Button variant="outline" size="sm">View all Compliance</Button>
              </Link>
            </div>
            {complianceLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading…</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["license", "medical", "contract"] as const).map((cat) => {
                  const items = complianceItems.filter((i) => i.category === cat);
                  const valid = items.filter((i) => i.status === "valid").length;
                  const expiring = items.filter((i) => i.status === "expiring").length;
                  const expired = items.filter((i) => i.status === "expired").length;
                  const missing = items.filter((i) => i.status === "missing").length;
                  const nearest = items
                    .filter((i) => i.valid_to && i.days_left != null && i.days_left >= 0)
                    .sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))[0];
                  const title = cat === "license" ? "Licenses" : cat === "medical" ? "Medical" : "Contracts";
                  const complianceLink = `/app/compliance?category=${cat}`;
                  return (
                    <Card key={cat}>
                      <CardHeader>
                        <CardTitle className="text-base">{title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Valid: {valid} · Expiring: {expiring} · Expired: {expired} · Missing: {missing}
                        </p>
                        {nearest ? (
                          <p className="text-xs mt-2">
                            Nearest expiry: {nearest.valid_to ? new Date(nearest.valid_to).toLocaleDateString("sv-SE") : "—"} ({nearest.days_left} days)
                          </p>
                        ) : (
                          <p className="text-xs mt-2 text-muted-foreground">No expiry dates</p>
                        )}
                        <Link href={complianceLink} className="text-xs text-primary hover:underline mt-2 inline-block">
                          View in Compliance →
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "one-to-ones" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle>1:1 Meetings / Medarbetarsamtal</CardTitle>
              <Link href={`/app/employees/${id}/one-to-ones`}>
                <Button size="sm" data-testid="button-view-all-meetings">
                  View All
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">No 1:1 meetings scheduled</p>
                  <Link href={`/app/employees/${id}/one-to-ones`}>
                    <Button data-testid="button-schedule-meeting">
                      <Plus className="h-4 w-4 mr-2" />
                      Schedule Meeting
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {meetings.slice(0, 5).map((meeting) => (
                    <Link key={meeting.id} href={`/app/one-to-ones/${meeting.id}`}>
                      <div className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer">
                        <div>
                          <p className="font-medium">{meeting.templateName || "1:1 Meeting"}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(meeting.scheduledAt).toLocaleDateString("sv-SE")} with {meeting.managerName}
                          </p>
                        </div>
                        <Badge variant={statusVariants[meeting.status] || "outline"}>
                          {meeting.status.replace("_", " ")}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "documents" && (
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No documents</p>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-sm text-muted-foreground capitalize">{doc.type.replace("_", " ")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.validTo && (
                          <span className="text-sm text-muted-foreground">
                            Valid to: {new Date(doc.validTo).toLocaleDateString("sv-SE")}
                          </span>
                        )}
                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                          <Button size="icon" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "events" && (
          <Card>
            <CardHeader>
              <CardTitle>People Risk & Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No events or tasks</p>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div>
                        <p className="font-medium">{event.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {categoryLabels[event.category] || event.category} &middot; Due: {new Date(event.dueDate).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                      <Badge variant={statusVariants[event.status] || "outline"}>
                        {event.status.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeTab === "equipment" && (
          <Card>
            <CardHeader>
              <CardTitle>Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              {equipment.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No equipment assigned</p>
              ) : (
                <div className="space-y-3">
                  {equipment.map((eq) => (
                    <div key={eq.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{eq.equipmentName || "Unknown"}</p>
                          <p className="text-sm text-muted-foreground">{eq.serialNumber}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="secondary">{eq.status}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Assigned: {new Date(eq.assignedDate).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
