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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type {
  Employee,
  EmployeeSkill,
  PersonEvent,
  Document,
  EmployeeEquipment,
  EmployeeReview,
  SalaryRecord,
  SalaryRevision,
} from "@/types/domain";
import { logEmployeeAccess } from "@/services/gdpr";

type EmployeeData = {
  employee: Employee | null;
  skills: EmployeeSkill[];
  events: PersonEvent[];
  documents: Document[];
  equipment: EmployeeEquipment[];
  reviews: EmployeeReview[];
  currentSalary: SalaryRecord | null;
  salaryRevisions: SalaryRevision[];
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
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "personal" | "employment" | "competence" | "events" | "documents" | "equipment" | "reviews" | "salary"
  >("personal");

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
      ] = await Promise.all([
        supabase.from("employees").select("*, manager:manager_id(name)").eq("id", id).single(),
        supabase.from("employee_skills").select("*, skills(*)").eq("employee_id", id),
        supabase.from("person_events").select("*").eq("employee_id", id).order("due_date"),
        supabase.from("documents").select("*").eq("employee_id", id).order("created_at", { ascending: false }),
        supabase.from("employee_equipment").select("*, equipment(*)").eq("employee_id", id).eq("status", "assigned"),
        supabase.from("employee_reviews").select("*, manager:manager_id(name), template:template_id(name)").eq("employee_id", id).order("review_date", { ascending: false }),
        supabase.from("salary_records").select("*").eq("employee_id", id).order("effective_from", { ascending: false }).limit(1),
        supabase.from("salary_revisions").select("*, manager:decided_by_manager_id(name)").eq("employee_id", id).order("revision_date", { ascending: false }),
      ]);

      if (employeeRes.data) {
        try {
          await logEmployeeAccess(id, "view_profile");
        } catch (e) {
          console.error("Error logging access:", e);
        }
      }

      const empData = employeeRes.data;
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
              managerName: empData.manager?.name || undefined,
              address: empData.address || undefined,
              city: empData.city || undefined,
              postalCode: empData.postal_code || undefined,
              country: empData.country || "Sweden",
              isActive: empData.is_active ?? true,
            }
          : null,
        skills: (skillsRes.data || []).map((row) => ({
          employeeId: row.employee_id,
          skillId: row.skill_id,
          level: row.level,
          skillName: row.skills?.name,
          skillCode: row.skills?.code,
          skillCategory: row.skills?.category,
        })),
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
        equipment: (equipRes.data || []).map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          equipmentId: row.equipment_id,
          equipmentName: row.equipment?.name,
          serialNumber: row.equipment?.serial_number,
          assignedDate: row.assigned_date,
          returnDate: row.return_date,
          status: row.status,
        })),
        reviews: (reviewsRes.data || []).map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          managerId: row.manager_id,
          managerName: row.manager?.name,
          templateId: row.template_id,
          templateName: row.template?.name,
          reviewDate: row.review_date,
          periodStart: row.period_start,
          periodEnd: row.period_end,
          overallRating: row.overall_rating,
          summary: row.summary,
          goals: row.goals,
          notes: row.notes,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })),
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
        salaryRevisions: (revisionsRes.data || []).map((row) => ({
          id: row.id,
          employeeId: row.employee_id,
          revisionDate: row.revision_date,
          previousSalarySek: parseFloat(row.previous_salary_sek) || 0,
          newSalarySek: parseFloat(row.new_salary_sek) || 0,
          salaryType: row.salary_type || "monthly",
          reason: row.reason || undefined,
          decidedByManagerId: row.decided_by_manager_id || undefined,
          decidedByManagerName: row.manager?.name || undefined,
          documentId: row.document_id,
          createdAt: row.created_at,
        })),
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
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data.employee) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">Employee not found</p>
        <Link
          href="/app/employees"
          className="text-blue-600 dark:text-blue-400 hover:underline mt-2 inline-block"
        >
          Back to employees
        </Link>
      </div>
    );
  }

  const { employee, skills, events, documents, equipment, reviews, currentSalary, salaryRevisions } = data;

  const tabs = [
    { id: "personal", label: "Personal Info", icon: User },
    { id: "employment", label: "Employment", icon: Briefcase },
    { id: "competence", label: "Competence", icon: Star },
    { id: "events", label: "Events", icon: AlertTriangle, count: events.filter((e) => e.status !== "completed").length },
    { id: "documents", label: "Documents", icon: FileText, count: documents.length },
    { id: "equipment", label: "Equipment", icon: Package, count: equipment.length },
    { id: "reviews", label: "Reviews", icon: Star, count: reviews.length },
    { id: "salary", label: "Salary", icon: Banknote },
  ] as const;

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

  const statusColors: Record<string, string> = {
    upcoming: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    due_soon: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    overdue: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/app/employees")}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
          data-testid="button-back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {employee.name}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {employee.employeeNumber} &middot; {employee.role || "No role"} &middot;{" "}
            {employee.line || "No line"}
          </p>
        </div>
        <button
          onClick={handleExportData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
          data-testid="button-export-gdpr"
        >
          <Shield className="h-4 w-4" />
          Export Data (GDPR)
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
              {"count" in tab && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {activeTab === "personal" && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Personal Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={User} label="Full Name" value={employee.name} />
              <InfoRow icon={User} label="Employee Number" value={employee.employeeNumber} />
              <InfoRow icon={Mail} label="Email" value={employee.email || "-"} />
              <InfoRow icon={Phone} label="Phone" value={employee.phone || "-"} />
              <InfoRow icon={Calendar} label="Date of Birth" value={employee.dateOfBirth ? new Date(employee.dateOfBirth).toLocaleDateString() : "-"} />
              <InfoRow icon={MapPin} label="Address" value={employee.address || "-"} />
              <InfoRow icon={MapPin} label="City" value={employee.city || "-"} />
              <InfoRow icon={MapPin} label="Postal Code" value={employee.postalCode || "-"} />
              <InfoRow icon={MapPin} label="Country" value={employee.country || "Sweden"} />
            </div>
          </div>
        )}

        {activeTab === "employment" && (
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Employment Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={Briefcase} label="Employment Type" value={employee.employmentType} />
              <InfoRow icon={Briefcase} label="Role" value={employee.role || "-"} />
              <InfoRow icon={Briefcase} label="Line" value={employee.line || "-"} />
              <InfoRow icon={Briefcase} label="Team" value={employee.team || "-"} />
              <InfoRow icon={Calendar} label="Start Date" value={employee.startDate ? new Date(employee.startDate).toLocaleDateString() : "-"} />
              <InfoRow icon={Calendar} label="Contract End Date" value={employee.contractEndDate ? new Date(employee.contractEndDate).toLocaleDateString() : "-"} />
              <InfoRow icon={User} label="Manager" value={employee.managerName || "-"} />
            </div>
          </div>
        )}

        {activeTab === "competence" && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Competence Summary
            </h2>
            {skills.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No skills recorded</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {skills.map((skill) => (
                  <div
                    key={skill.skillId}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {skill.skillName}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {skill.skillCode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${(skill.level / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-300 w-20 text-right">
                        {levelLabels[skill.level]}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "events" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Person Events / Tasks
              </h2>
            </div>
            {events.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No events</p>
            ) : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {event.title}
                        </span>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${statusColors[event.status]}`}
                        >
                          {event.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {categoryLabels[event.category]} &middot; Due:{" "}
                        {new Date(event.dueDate).toLocaleDateString()}
                        {event.completedDate && (
                          <> &middot; Completed: {new Date(event.completedDate).toLocaleDateString()}</>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Documents
            </h2>
            {documents.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No documents attached</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div className="flex-1">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {doc.title}
                      </a>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {doc.type} &middot; {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "equipment" && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Assigned Equipment
            </h2>
            {equipment.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No equipment assigned</p>
            ) : (
              <div className="space-y-2">
                {equipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <Package className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{eq.equipmentName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        SN: {eq.serialNumber} &middot; Assigned:{" "}
                        {new Date(eq.assignedDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "reviews" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Medarbetarsamtal & Development
              </h2>
              <Link
                href={`/app/employees/${id}/reviews/new`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                data-testid="button-new-review"
              >
                <Plus className="h-4 w-4" />
                New Review
              </Link>
            </div>
            {reviews.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No reviews yet</p>
            ) : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {review.templateName || "Review"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(review.reviewDate).toLocaleDateString()} &middot; by{" "}
                          {review.managerName || "Unknown"}
                        </p>
                      </div>
                      {review.overallRating && (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.overallRating!
                                  ? "text-yellow-400 fill-yellow-400"
                                  : "text-gray-300 dark:text-gray-600"
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {review.summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        {review.summary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "salary" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                Salary & Revisions
              </h2>
              <Link
                href={`/app/employees/${id}/salary/new`}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                data-testid="button-new-revision"
              >
                <Plus className="h-4 w-4" />
                New Revision
              </Link>
            </div>

            {currentSalary && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md mb-4">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-1">Current Salary</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {currentSalary.salaryAmountSek.toLocaleString("sv-SE")} SEK
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    / {currentSalary.salaryType}
                  </span>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Effective from {new Date(currentSalary.effectiveFrom).toLocaleDateString()}
                </p>
              </div>
            )}

            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Revision History
            </h3>
            {salaryRevisions.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No revisions recorded</p>
            ) : (
              <div className="space-y-2">
                {salaryRevisions.map((rev) => (
                  <div
                    key={rev.id}
                    className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400 line-through">
                          {rev.previousSalarySek.toLocaleString("sv-SE")}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {rev.newSalarySek.toLocaleString("sv-SE")} SEK
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(rev.revisionDate).toLocaleDateString()}
                        {rev.decidedByManagerName && <> &middot; by {rev.decidedByManagerName}</>}
                        {rev.reason && <> &middot; {rev.reason}</>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-5 w-5 text-gray-400 mt-0.5" />
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
      </div>
    </div>
  );
}
