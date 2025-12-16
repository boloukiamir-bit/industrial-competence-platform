"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getHrTaskBuckets, HrTaskBuckets, HrTask } from "@/services/hrTasks";

export default function HrTasksPage() {
  const [buckets, setBuckets] = useState<HrTaskBuckets | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(true);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user || user.role !== "HR_ADMIN") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

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
    (buckets?.upcoming.length ?? 0);

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

  if (!authorized) {
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
    <main className="hr-page" data-testid="hr-tasks-page">
      <header className="hr-page__header">
        <div>
          <h1 className="hr-page__title">HR Tasks</h1>
          <p className="hr-page__subtitle">
            All open workflow steps, sorted by urgency - overdue, today and the coming week.
          </p>
        </div>
      </header>

      {error && <p className="hr-error">{error}</p>}

      {!error && buckets && (
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
        </>
      )}
    </main>
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
