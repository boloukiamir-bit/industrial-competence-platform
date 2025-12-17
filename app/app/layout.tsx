"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Grid3X3, 
  AlertTriangle, 
  Upload, 
  Users, 
  Settings,
  ShieldAlert,
  Package,
  Newspaper,
  FileText,
  BookOpen,
  Shield,
  Building2,
  BarChart3,
  Workflow,
  LogOut,
  Wrench,
  TrendingUp,
  Lock,
  Clipboard
} from "lucide-react";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth";
import { OrgProvider } from "@/components/OrgProvider";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { COPY } from "@/lib/copy";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hrAdminOnly?: boolean;
  comingSoon?: boolean;
};

const coreNavItems: NavItem[] = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Setup", href: "/app/setup", icon: Clipboard },
  { name: "Employees", href: "/app/employees", icon: Users },
  { name: "Organization", href: "/app/org/overview", icon: Building2 },
  { name: "Competence Matrix", href: "/app/competence-matrix", icon: Grid3X3 },
  { name: "Tomorrow's Gaps", href: "/app/gaps", icon: TrendingUp },
  { name: "Admin", href: "/app/admin", icon: Wrench, hrAdminOnly: true },
];

const hrNavItems: NavItem[] = [
  { name: "Manager Risks", href: "/app/manager/risks", icon: ShieldAlert },
  { name: "HR Analytics", href: "/app/hr/analytics", icon: BarChart3, hrAdminOnly: true },
  { name: "HR Workflows", href: "/app/hr/workflows", icon: Workflow, hrAdminOnly: true },
  { name: "Import Employees", href: "/app/import-employees", icon: Upload, hrAdminOnly: true },
];

const comingSoonNavItems: NavItem[] = [
  { name: "Safety / Certificates", href: "/app/safety/certificates", icon: Shield, comingSoon: true },
  { name: "Equipment", href: "/app/equipment", icon: Package, comingSoon: true },
  { name: "Handbooks", href: "/app/handbooks", icon: BookOpen, comingSoon: true },
  { name: "Documents", href: "/app/documents", icon: FileText, comingSoon: true },
  { name: "News", href: "/app/news", icon: Newspaper, comingSoon: true },
];

const settingsNavItems: NavItem[] = [
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuth(true);
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getCurrentUser().then(setUser);
    }
  }, [isAuthenticated]);

  async function handleSignOut() {
    try {
      await signOut();
      router.push("/login");
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  }

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const filterItems = (items: NavItem[]) => 
    items.filter((item) => {
      if (item.hrAdminOnly && user?.role !== "HR_ADMIN") return false;
      return true;
    });

  const visibleCoreItems = filterItems(coreNavItems);
  const visibleHrItems = filterItems(hrNavItems);
  const visibleSettingsItems = filterItems(settingsNavItems);

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
    const Icon = item.icon;

    if (item.comingSoon) {
      return (
        <li key={item.name}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-400 dark:text-gray-500 cursor-not-allowed"
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <Icon className="h-4 w-4" />
                {item.name}
                <Lock className="h-3 w-3 ml-auto" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Coming soon</p>
            </TooltipContent>
          </Tooltip>
        </li>
      );
    }

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive
              ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
              : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
          data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Icon className="h-4 w-4" />
          {item.name}
        </Link>
      </li>
    );
  };

  return (
    <OrgProvider>
      <TooltipProvider>
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
          <DemoModeBanner />
          <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Industrial Competence
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Platform</p>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
              <div className="mb-4">
                <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {COPY.nav.core}
                </p>
                <ul className="space-y-1">
                  {visibleCoreItems.map(renderNavItem)}
                </ul>
              </div>

              {visibleHrItems.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    HR Tools
                  </p>
                  <ul className="space-y-1">
                    {visibleHrItems.map(renderNavItem)}
                  </ul>
                </div>
              )}

              <div className="mb-4">
                <p className="px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {COPY.nav.comingSoon}
                </p>
                <ul className="space-y-1">
                  {comingSoonNavItems.map(renderNavItem)}
                </ul>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <ul className="space-y-1">
                  {visibleSettingsItems.map(renderNavItem)}
                </ul>
              </div>
            </nav>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 dark:text-gray-300" data-testid="text-user-email">
                  {authUser?.email || user?.email || "User"}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                  data-testid="button-signout"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </header>

            <main className="flex-1 overflow-auto">
              {children}
            </main>
            </div>
          </div>
        </div>
      </TooltipProvider>
    </OrgProvider>
  );
}
