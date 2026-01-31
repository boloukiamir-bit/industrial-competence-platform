"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { apiPost } from "@/lib/apiClient";
import { 
  Wrench, 
  Briefcase, 
  Users, 
  Shield, 
  Settings,
  ChevronRight,
  AlertCircle,
  Building2,
  ClipboardList,
  FileUp,
  Trash2,
  Loader2,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface AdminCard {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminCards: AdminCard[] = [
  {
    title: "Organizations",
    description: "Create and manage organizations. Switch between organizations.",
    href: "/app/org/select",
    icon: Building2,
  },
  {
    title: "User Management",
    description: "Invite users, manage roles, and control team access.",
    href: "/app/admin/users",
    icon: Users,
  },
  {
    title: "Audit Log",
    description: "View activity history and track admin actions.",
    href: "/app/admin/audit",
    icon: ClipboardList,
  },
  {
    title: "Import Employees",
    description: "Upload CSV to import or update employees (v1).",
    href: "/app/admin/import",
    icon: FileUp,
  },
  {
    title: "Master Data: Lines & Stations",
    description: "Manage lines (areas), area leaders, and stations. Import/export CSV.",
    href: "/app/admin/master-data/lines",
    icon: Layers,
  },
  {
    title: "Competence Admin",
    description: "Manage competence groups and competences used in matrices and gap analysis.",
    href: "/admin/competence",
    icon: Wrench,
  },
  {
    title: "Positions Admin",
    description: "Configure positions and their competence requirements.",
    href: "/admin/positions",
    icon: Briefcase,
  },
  {
    title: "Security Settings",
    description: "Configure authentication and access control policies.",
    href: "/app/admin/security",
    icon: Shield,
  },
  {
    title: "System Settings",
    description: "Configure platform-wide settings and integrations.",
    href: "/app/admin/settings",
    icon: Settings,
  },
];

const PURGE_CONFIRM_TEXT = "PURGE";

type AdminMe = { email: string | null; active_org_id: string; membership_role: string } | null;

export default function AdminDashboard() {
  const { toast, toasts } = useToast();
  const [adminMe, setAdminMe] = useState<AdminMe>(null);
  const [adminMeLoading, setAdminMeLoading] = useState(true);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeConfirmInput, setPurgeConfirmInput] = useState("");
  const [purgeLoading, setPurgeLoading] = useState(false);

  const fetchAdminMe = useCallback(async () => {
    setAdminMeLoading(true);
    try {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) {
        setAdminMe(null);
        return;
      }
      const data = await res.json();
      setAdminMe({
        email: data.email ?? null,
        active_org_id: data.active_org_id,
        membership_role: data.membership_role ?? "",
      });
    } catch {
      setAdminMe(null);
    } finally {
      setAdminMeLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminMe();
  }, [fetchAdminMe]);

  const handlePurgeDemo = async () => {
    if (purgeConfirmInput.trim() !== PURGE_CONFIRM_TEXT) return;
    setPurgeLoading(true);
    try {
      const data = await apiPost<{ deactivatedEmployees: number }>("/api/admin/data-hygiene/purge-demo", {});
      const count = data?.deactivatedEmployees ?? 0;
      toast({
        title: "Demo data purged",
        description: count > 0 ? `${count} employee(s) deactivated.` : "No matching employees to deactivate.",
      });
      setPurgeDialogOpen(false);
      setPurgeConfirmInput("");
      window.location.reload();
    } catch (err) {
      toast({
        title: "Purge failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPurgeLoading(false);
    }
  };

  if (adminMeLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const membershipRole = adminMe?.membership_role ?? "";
  const isAdmin = membershipRole === "admin" || membershipRole === "hr";

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage platform configuration and settings.
        </p>
      </div>

      {!isAdmin && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Limited Access
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              You are viewing this page but may not have full admin privileges.
              Contact an administrator if you need elevated access.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {adminCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group block p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              data-testid={`card-${card.title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Icon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
              </div>
              <h3 className="mt-4 text-base font-medium text-gray-900 dark:text-white">
                {card.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {card.description}
              </p>
            </Link>
          );
        })}
      </div>

      {isAdmin && (
        <div className="mt-8 p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Data Hygiene</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Deactivate demo/test employees for the active organization (E9*, E100*, TEST*, name containing &quot;Test&quot;, or configured numbers). Idempotent; safe to run multiple times.
          </p>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setPurgeDialogOpen(true)}
            data-testid="button-purge-demo"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Purge demo/test data
          </Button>
        </div>
      )}

      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Purge demo/test data</DialogTitle>
            <DialogDescription>
              This will set is_active=false for demo/test employees in the active organization. Type <strong>{PURGE_CONFIRM_TEXT}</strong> below to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label htmlFor="purge-confirm">Confirmation</Label>
              <Input
                id="purge-confirm"
                type="text"
                value={purgeConfirmInput}
                onChange={(e) => setPurgeConfirmInput(e.target.value)}
                placeholder={PURGE_CONFIRM_TEXT}
                className="mt-1 font-mono"
                data-testid="input-purge-confirm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPurgeDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handlePurgeDemo}
                disabled={purgeConfirmInput.trim() !== PURGE_CONFIRM_TEXT || purgeLoading}
                data-testid="button-purge-confirm"
              >
                {purgeLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Purge
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border px-4 py-3 shadow-lg ${
                t.variant === "destructive"
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/80"
                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
              }`}
            >
              {t.title && <p className="font-medium text-sm">{t.title}</p>}
              {t.description && <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>}
            </div>
          ))}
        </div>
      )}

      {adminMe && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Signed in as{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {adminMe.email ?? "—"}
            </span>
            {" "}with role{" "}
            <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {adminMe.membership_role || "not set"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
