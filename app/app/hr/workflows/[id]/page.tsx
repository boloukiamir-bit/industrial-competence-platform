"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { WORKFLOW_TEMPLATES } from "@/services/hrWorkflows";
import type { HRWorkflowInstance, HRWorkflowStatus, HRWorkflowStep } from "@/types/domain";

export default function WorkflowDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [instance, setInstance] = useState<HRWorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const user = await getCurrentUser();
      if (!user || user.role !== "HR_ADMIN") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/workflows");
        if (response.ok) {
          const instances: HRWorkflowInstance[] = await response.json();
          const found = instances.find((i) => i.id === id);
          if (found) {
            setInstance(found);
          } else {
            setError("Workflow not found");
          }
        } else {
          setError("Failed to fetch workflow");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load workflow");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const template = instance ? WORKFLOW_TEMPLATES.find((t) => t.id === instance.templateId) : null;

  const statusBadge = (status: HRWorkflowStatus) => {
    switch (status) {
      case "active":
        return <Badge variant="default"><Clock className="h-3 w-3 mr-1" /> Active</Badge>;
      case "completed":
        return <Badge variant="secondary"><CheckCircle className="h-3 w-3 mr-1" /> Completed</Badge>;
      case "cancelled":
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" /> Cancelled</Badge>;
    }
  };

  if (loading) {
    return (
      <main className="hr-page">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32" />
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
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

  if (error || !instance) {
    return (
      <main className="hr-page">
        <button className="hr-link" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 inline mr-1" />
          Back to all workflows
        </button>
        <div className="hr-empty">
          <h2 className="text-lg font-semibold mb-2">Workflow Not Found</h2>
          <p className="text-gray-500">{error || "The requested workflow could not be found."}</p>
        </div>
      </main>
    );
  }

  const steps: HRWorkflowStep[] = instance.steps || [];

  return (
    <main className="hr-page" data-testid="workflow-detail-page">
      <Link href="/app/hr/workflows" className="hr-link">
        <ArrowLeft className="h-4 w-4 inline mr-1" />
        Back to all workflows
      </Link>

      <header className="hr-page__header hr-page__header--compact">
        <div>
          <div className="hr-card__badge mb-2">
            {template?.category ?? "Workflow"}
          </div>
          <h1 className="hr-page__title">{instance.templateName}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {instance.employeeName || "Unknown Employee"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Started {new Date(instance.startedAt).toLocaleDateString("sv-SE")}
            </span>
            {statusBadge(instance.status)}
          </div>
        </div>
        <div className="hr-page__actions">
          <Button variant="outline" onClick={() => router.back()}>
            Close
          </Button>
        </div>
      </header>

      <section className="hr-steps">
        <h2 className="hr-section__title">Workflow Steps</h2>
        {steps.length === 0 ? (
          <div className="hr-empty hr-empty--light">
            <p>No steps defined for this workflow.</p>
          </div>
        ) : (
          <ol className="hr-steps__list">
            {steps.map((step, index) => (
              <li 
                key={step.id} 
                className={`hr-steps__item ${step.isCompleted ? "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/10" : ""}`}
                data-testid={`step-${step.id}`}
              >
                <div className={`hr-steps__index ${step.isCompleted ? "bg-green-500 text-white border-green-500" : ""}`}>
                  {step.isCompleted ? <CheckCircle className="h-4 w-4" /> : index + 1}
                </div>
                <div className="hr-steps__content">
                  <div className="hr-steps__header">
                    <h3>{step.title}</h3>
                    <span className="hr-tag">
                      {step.responsibleRole?.toUpperCase() || "Unassigned"}
                    </span>
                  </div>
                  {step.description && (
                    <p className="hr-steps__description">{step.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1">
                    {step.daysFromStart != null && step.daysFromStart !== 0 && (
                      <p className="hr-steps__meta">
                        Due: Day {step.daysFromStart} after start
                      </p>
                    )}
                    {step.isCompleted && step.completedAt && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Completed {new Date(step.completedAt).toLocaleDateString("sv-SE")}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {instance.notes && (
        <section className="mt-8">
          <h2 className="hr-section__title">Notes</h2>
          <div className="hr-empty hr-empty--light">
            <p>{instance.notes}</p>
          </div>
        </section>
      )}
    </main>
  );
}
