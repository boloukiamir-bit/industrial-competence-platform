"use client";

import Link from "next/link";
import { useProfile } from "@/hooks/useProfile";
import { 
  Wrench, 
  Briefcase, 
  Users, 
  Shield, 
  Settings,
  ChevronRight,
  AlertCircle,
  Building2,
  ClipboardList
} from "lucide-react";

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

export default function AdminDashboard() {
  const { profile, loading } = useProfile();

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";

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

      {profile && (
        <div className="mt-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Signed in as{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {profile.email}
            </span>
            {" "}with role{" "}
            <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
              {profile.role || "not set"}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
