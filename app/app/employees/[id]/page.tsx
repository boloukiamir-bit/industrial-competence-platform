"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { getMeetingsForEmployee } from "@/services/oneToOne";

type TabId = "personal" | "contact" | "organisation" | "employment" | "compensation" | "competence" | "one-to-ones" | "documents" | "events" | "equipment";

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
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("personal");

  useEffect(() => {
    async function loadData() {
      const [
        employeeRes,
        skillsRes,
        eventsRes,
        docsRes,
        equipRes,
        reviewsRes,
        salaryRes,
        revisionsRes,
        meetingsData,
      ] = await Promise.all([
        supabase.from("employees").select("*, manager:manager_id(name)").eq("id", id).single(),
        supabase.from("employee_skills").select("*, skills(*)").eq("employee_id", id),
        supabase.from("person_events").select("*").eq("employee_id", id).order("due_date"),
        supabase.from("documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
        supabase.from("employee_equipment").select("*, equipment(*)").eq("employee_id", id).eq("status", "assigned"),
        supabase.from("employee_reviews").select("*, manager:manager_id(name), template:template_id(name)").eq("employee_id", id).order("review_date", { ascending: false }),
        supabase.from("salary_records").select("*").eq("employee_id", id).order("effective_from", { ascending: false }).limit(1),
        supabase.from("salary_revisions").select("*, manager:decided_by_manager_id(name)").eq("employee_id", id).order("revision_date", { ascending: false }),
        getMeetingsForEmployee(id),
      ]);

      if (employeeRes.data) {
        try {
          await logEmployeeAccess(id, "view_profile");
        } catch (e) {
          console.error("Error logging access:", e);
        }
      }

      const empData = employeeRes.data;
      const managerData = empData?.manager as { name: string } | null;
      
      setData({
        employee: empData
          ? {
              id: empData.id,
              name: empData.name || "",
              firstName: empData.first_name || undefined,
              lastName: empData.last_name || undefined,
              employeeNumber: empData.employee_number || "",
              email: empData.email || undefined,
              phone: empData.phone || undefined,
              dateOfBirth: empData.date_of_birth || undefined,
              role: empData.role || "",
              line: empData.line || "",
              team: empData.team || "",
              employmentType: empData.employment_type || "permanent",
              startDate: empData.start_date || undefined,
              contractEndDate: empData.contract_end_date || undefined,
              managerId: empData.manager_id || undefined,
              managerName: managerData?.name || undefined,
              address: empData.address || undefined,
              city: empData.city || undefined,
              postalCode: empData.postal_code || undefined,
              country: empData.country || "Sweden",
              isActive: empData.is_active ?? true,
            }
          : null,
        skills: (skillsRes.data || []).map((row) => {
          const skill = row.skills as { name: string; code: string; category: string } | null;
          return {
            employeeId: row.employee_id,
            skillId: row.skill_id,
            level: row.level,
            skillName: skill?.name,
            skillCode: skill?.code,
            skillCategory: skill?.category,
          };
        }),
        events: (eventsRes.data || []).map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          category: row.category,
          title: row.title,
          description: row.description,
          dueDate: row.due_date,
          completedDate: row.completed_date,
          recurrence: row.recurrence,
          ownerManagerId: row.owner_manager_id,
          status: row.status,
          notes: row.notes,
        })),
        documents: (docsRes.data || []).map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          title: row.title,
          type: row.type,
          url: row.url,
          createdAt: row.created_at,
          validTo: row.valid_to,
        })),
        equipment: (equipRes.data || []).map((row) => {
          const equip = row.equipment as { name: string; serial_number: string } | null;
          return {
            id: row.id,
            employeeId: row.employee_id,
            equipmentId: row.equipment_id,
            equipmentName: equip?.name,
            serialNumber: equip?.serial_number,
            assignedDate: row.assigned_date,
            returnDate: row.return_date,
            status: row.status,
          };
        }),
        reviews: (reviewsRes.data || []).map((row) => {
          const manager = row.manager as { name: string } | null;
          const template = row.template as { name: string } | null;
          return {
            id: row.id,
            employeeId: row.employee_id,
            managerId: row.manager_id,
            managerName: manager?.name,
            templateId: row.template_id,
            templateName: template?.name,
            reviewDate: row.review_date,
            periodStart: row.period_start,
            periodEnd: row.period_end,
            overallRating: row.overall_rating,
            summary: row.summary,
            goals: row.goals,
            notes: row.notes,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }),
        currentSalary:
          salaryRes.data && salaryRes.data.length > 0
            ? {
                id: salaryRes.data[0].id,
                employeeId: salaryRes.data[0].employee_id,
                effectiveFrom: salaryRes.data[0].effective_from,
                salaryAmountSek: parseFloat(salaryRes.data[0].salary_amount_sek) || 0,
                salaryType: salaryRes.data[0].salary_type || "monthly",
                positionTitle: salaryRes.data[0].position_title || undefined,
                notes: salaryRes.data[0].notes || undefined,
                createdAt: salaryRes.data[0].created_at,
                createdBy: salaryRes.data[0].created_by || undefined,
              }
            : null,
        salaryRevisions: (revisionsRes.data || []).map((row) => {
          const manager = row.manager as { name: string } | null;
          return {
            id: row.id,
            employeeId: row.employee_id,
            revisionDate: row.revision_date,
            previousSalarySek: parseFloat(row.previous_salary_sek) || 0,
            newSalarySek: parseFloat(row.new_salary_sek) || 0,
            salaryType: row.salary_type || "monthly",
            reason: row.reason || undefined,
            decidedByManagerId: row.decided_by_manager_id || undefined,
            decidedByManagerName: manager?.name || undefined,
            documentId: row.document_id,
            createdAt: row.created_at,
          };
        }),
        meetings: meetingsData,
      });
      setLoading(false);
    }
    if (id) loadData();
  }, [id]);

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

  const { employee, skills, events, documents, equipment, reviews, currentSalary, salaryRevisions, meetings } = data;

  const navItems: { id: TabId; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "personal", label: "Personal Data", icon: User },
    { id: "contact", label: "Contact Information", icon: Mail },
    { id: "organisation", label: "Organisation", icon: Building2 },
    { id: "employment", label: "Job & Employment", icon: Briefcase },
    { id: "compensation", label: "Compensation", icon: Banknote },
    { id: "competence", label: "Competence", icon: Star, count: skills.length },
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
