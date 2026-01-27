"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHrTaskBuckets, HrTaskBuckets, HrTask, ExpiringItem } from "@/services/hrTasks";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { isHrAdmin } from "@/lib/auth";
import { IssueInboxSection } from "@/components/IssueInboxSection";

export default function HrTasksPage() {
  const { loading: authLoading } = useAuthGuard();
  const { currentRole, isLoading: orgLoading, currentOrg, memberships } = useOrg();
  const { user: authUser } = useAuth();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Derived authorization: purely computed from currentRole and orgLoading
  const roleNormalized = (currentRole ?? "").toLowerCase();
  const canAccess = !orgLoading && isHrAdmin(roleNormalized);

  // Load user email for diagnostic
  useEffect(() => {
    if (authUser?.email) {
      setUserEmail(authUser.email);
    } else {
      getCurrentUser().then((user) => {
        if (user?.email) {
          setUserEmail(user.email);
        }
      });
    }
  }, [authUser]);

  // Render flow: auth loading -> org loading -> access denied -> body
  if (authLoading) {
    return (
      <main className="hr-page">
        <p>Checking access...</p>
      </main>
    );
  }

  if (orgLoading) {
    return (
      <main className="hr-page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="hr-kpi-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </main>
    );
  }

  if (!canAccess) {
    return (
      <main className="hr-page">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-500 dark:text-gray-400">
              This page is only accessible to HR Administrators.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <HrTasksBody
      currentOrg={currentOrg}
      currentRole={currentRole}
      memberships={memberships}
      userEmail={userEmail}
    />
  );
}

function HrTasksBody({
  currentOrg,
  currentRole,
  memberships,
  userEmail,
}: {
  currentOrg: { id: string } | null;
  currentRole: string | null;
  memberships: unknown[];
  userEmail: string | null;
}) {
  const [viewMode, setViewMode] = useState<"hr" | "inbox">("hr");
  const [buckets, setBuckets] = useState<HrTaskBuckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data fetching: only runs when authorized (this component only renders when authorized)
  useEffect(() => {
    async function load() {
      try {
        const data = await getHrTaskBuckets();
        setBuckets(data);
      } catch (err) {
        console.error(err);
        setError("Could not load HR tasks.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalTasks =
    (buckets?.overdue.length ?? 0) +
    (buckets?.today.length ?? 0) +
    (buckets?.upcoming.length ?? 0) +
    (buckets?.expiring.length ?? 0);

  if (loading) {
    return (
      <main className="hr-page">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
          <div className="hr-kpi-grid">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </main>
    );
  }

  return (
    <main className="hr-page" data-testid="hr-tasks-page">
      <header className="hr-page__header">
        <div>
          <h1 className="hr-page__title">HR Tasks</h1>
          <p className="hr-page__subtitle">
            {viewMode === "hr"
              ? "All open workflow steps, sorted by urgency - overdue, today and the coming week."
              : "Unified inbox of cockpit issues and HR expiring items."}
          </p>
        </div>
      </header>

      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "hr" | "inbox")} className="mb-6">
        <TabsList>
          <TabsTrigger value="hr">HR Tasks</TabsTrigger>
          <TabsTrigger value="inbox">Issue Inbox</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* DEV-ONLY diagnostic - must not leak in production */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-gray-700 dark:text-gray-300">
          <strong>DEV Diagnostic:</strong>{" "}
          email: {userEmail ?? "loading..."} |{" "}
          active org: {currentOrg?.id ?? "none"} |{" "}
          currentRole: {currentRole ?? "null"} |{" "}
          memberships: {memberships.length}
          {buckets?.expiringMeta && (
            <>
              {" | "}
              expiring medical: {buckets.expiringMeta.medical_count} |{" "}
              expiring certs: {buckets.expiringMeta.cert_count}
            </>
          )}
        </div>
      )}

      {viewMode === "inbox" ? (
        <IssueInboxSection />
      ) : (
        <>
          {error && <p className="hr-error">{error}</p>}

          {!error && buckets && (
            <>
              {totalTasks === 0 && buckets.expiring.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <div className="max-w-md mx-auto">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        No active workflows
                      </h2>
                      <p className="text-gray-500 dark:text-gray-400 mb-6">
                        Get started by creating a workflow from a template. You can manage sick leave follow-ups, rehabilitation processes, parental leave, and more.
                      </p>
                      <Link href="/app/hr/workflows/templates">
                        <Button>
                          View Workflow Templates
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <section className="hr-kpi-grid" data-testid="kpi-grid">
                    <div className="hr-kpi">
                      <div className="hr-kpi__label">Active tasks</div>
                      <div className="hr-kpi__value" data-testid="kpi-active">{totalTasks}</div>
                    </div>
                    <div className="hr-kpi">
                      <div className="hr-kpi__label">Overdue</div>
                      <div className="hr-kpi__value hr-kpi__value--danger" data-testid="kpi-overdue">
                        {buckets.overdue.length}
                      </div>
                    </div>
                    <div className="hr-kpi">
                      <div className="hr-kpi__label">Due today</div>
                      <div className="hr-kpi__value hr-kpi__value--warn" data-testid="kpi-today">
                        {buckets.today.length}
                      </div>
                    </div>
                    <div className="hr-kpi">
                      <div className="hr-kpi__label">Next 7 days</div>
                      <div className="hr-kpi__value hr-kpi__value--ok" data-testid="kpi-upcoming">
                        {buckets.upcoming.length}
                      </div>
                    </div>
                  </section>

                  <TaskSection
                    title="Overdue"
                    description="Tasks that should already have been completed."
                    tasks={buckets.overdue}
                    badgeClass="hr-pill--danger"
                    testId="section-overdue"
                  />

                  <TaskSection
                    title="Due today"
                    description="Tasks that must be handled today."
                    tasks={buckets.today}
                    badgeClass="hr-pill--warn"
                    testId="section-today"
                  />

                  <TaskSection
                    title="Coming 7 days"
                    description="Tasks with deadlines within the next week."
                    tasks={buckets.upcoming}
                    badgeClass="hr-pill--ok"
                    testId="section-upcoming"
                  />

                  {buckets.expiring && buckets.expiring.length > 0 && (
                    <ExpiringSection 
                      expiring={buckets.expiring}
                      onResolve={() => {
                        // Refresh buckets after resolve
                        setBuckets(null);
                        setLoading(true);
                        getHrTaskBuckets()
                          .then(setBuckets)
                          .catch((err) => {
                            console.error(err);
                            setError("Could not load HR tasks.");
                          })
                          .finally(() => setLoading(false));
                      }}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}

function ExpiringSection({ expiring, onResolve }: { 
  expiring: Array<{
    id: string;
    employee_id: string;
    employee_name: string | null;
    type: "medical" | "cert";
    item_name: string;
    expires_on: string;
    days_to_expiry: number;
    severity: "P0" | "P1" | "P2";
  }>;
  onResolve: () => void;
}) {
  return (
    <section className="hr-task-section" data-testid="section-expiring">
      <header className="hr-task-section__header">
        <div>
          <h2 className="hr-section__title">Expiring Soon</h2>
          <p className="hr-task-section__description">
            Medical checks and certificates expiring within 30 days or already expired.
          </p>
        </div>
        <span className="hr-pill hr-pill--danger">{expiring.length}</span>
      </header>

      {expiring.length === 0 ? (
        <p className="hr-task-empty">No expiring items.</p>
      ) : (
        <div className="hr-task-list">
          {expiring.map((item) => (
            <div key={item.id} className="hr-task-row" data-testid={`expiring-item-${item.id}`}>
              <div className="hr-task-row__main">
                <h3 className="hr-task-row__title">{item.item_name}</h3>
                <p className="hr-task-row__subtitle">
                  {item.employee_name ?? "Unknown employee"} - {item.type === "medical" ? "Medical Check" : "Certificate"}
                </p>
              </div>
              <div className="hr-task-row__meta">
                <span className="hr-task-row__date">
                  {new Date(item.expires_on).toLocaleDateString("sv-SE")}
                  {item.days_to_expiry < 0 && " (expired)"}
                  {item.days_to_expiry >= 0 && ` (${item.days_to_expiry} days)`}
                </span>
                <span className={`hr-task-row__status ${
                  item.severity === "P0" ? "hr-task-row__status--danger" :
                  item.severity === "P1" ? "hr-task-row__status--warn" :
                  "hr-task-row__status--ok"
                }`}>
                  {item.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

type TaskSectionProps = {
  title: string;
  description: string;
  tasks: HrTask[];
  badgeClass: string;
  testId: string;
};

function TaskSection({ title, description, tasks, badgeClass, testId }: TaskSectionProps) {
  return (
    <section className="hr-task-section" data-testid={testId}>
      <header className="hr-task-section__header">
        <div>
          <h2 className="hr-section__title">{title}</h2>
          <p className="hr-task-section__description">{description}</p>
        </div>
        <span className={`hr-pill ${badgeClass}`}>{tasks.length}</span>
      </header>

      {tasks.length === 0 ? (
        <p className="hr-task-empty">No tasks in this bucket.</p>
      ) : (
        <div className="hr-task-list">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: HrTask }) {
  const dueLabel = task.dueDate
    ? new Date(task.dueDate).toLocaleDateString("sv-SE")
    : "No due date";

  const href = `/app/hr/workflows`;

  const statusLabel =
    task.status === "not_started"
      ? "Not started"
      : task.status === "in_progress"
      ? "In progress"
      : task.status === "done"
      ? "Done"
      : task.status;

  return (
    <Link href={href} className="hr-task-row" data-testid={`task-row-${task.id}`}>
      <div className="hr-task-row__main">
        <h3 className="hr-task-row__title">{task.stepTitle}</h3>
        <p className="hr-task-row__subtitle">
          {task.employeeName ?? "Unknown employee"} - {task.workflowName}
        </p>
      </div>
      <div className="hr-task-row__meta">
        <span className="hr-task-row__date">{dueLabel}</span>
        <span className="hr-task-row__status">{statusLabel}</span>
      </div>
    </Link>
  );
}
