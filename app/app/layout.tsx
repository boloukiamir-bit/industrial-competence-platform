"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Grid3X3, 
  Upload, 
  Users, 
  Settings,
  Settings2,
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
  Clipboard,
  Bug,
  Gauge,
  Factory,
  Target,
  ClipboardCheck,
  Inbox,
  Lightbulb
} from "lucide-react";
import { getCurrentUser, type CurrentUser, isHrAdmin } from "@/lib/auth";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth";
import { OrgProvider } from "@/components/OrgProvider";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { SessionDebugStrip } from "@/components/SessionDebugStrip";
import { VersionStrip } from "@/components/VersionStrip";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { Skeleton } from "@/components/ui/skeleton";
import { COPY } from "@/lib/copy";
import { getSpaliDevMode } from "@/lib/spaliDevMode";

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  hrAdminOnly?: boolean;
};

const coreNavItems: NavItem[] = [
  { name: "Cockpit", href: "/app/cockpit", icon: Gauge },
  { name: "Line Overview", href: "/app/line-overview", icon: Factory },
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Employees", href: "/app/employees", icon: Users },
  { name: "Organization", href: "/app/org/overview", icon: Building2 },
  { name: "Competence Matrix", href: "/app/competence-matrix", icon: Grid3X3 },
  { name: "Compliance", href: "/app/compliance", icon: ClipboardCheck },
  { name: "Compliance Matrix", href: "/app/compliance/matrix", icon: Grid3X3 },
  { name: "Tomorrow's Gaps", href: "/app/tomorrows-gaps", icon: TrendingUp },
  { name: "Setup", href: "/app/setup", icon: Clipboard },
  { name: "Admin", href: "/app/admin", icon: Wrench, hrAdminOnly: true },
];

const hrNavItems: NavItem[] = [
  { name: "Manager Risks", href: "/app/manager/risks", icon: ShieldAlert },
  { name: "Compliance Summary", href: "/app/compliance/summary", icon: BarChart3, hrAdminOnly: true },
  { name: "Action Inbox", href: "/app/compliance/actions", icon: Inbox, hrAdminOnly: true },
  { name: "HR Tasks", href: "/app/hr/tasks", icon: Clipboard, hrAdminOnly: true },
  { name: "HR Analytics", href: "/app/hr/analytics", icon: BarChart3, hrAdminOnly: true },
  { name: "Import Employees", href: "/app/import-employees", icon: Upload, hrAdminOnly: true },
];

const strategicPlanningNavItems: NavItem[] = [
  { name: "Scenario Builder", href: "/app/strategic-planning/scenario-builder", icon: Lightbulb },
];

const moreNavItems: NavItem[] = [
  { name: "Safety / Certificates", href: "/app/safety/certificates", icon: Shield },
  { name: "Equipment", href: "/app/equipment", icon: Package },
  { name: "Handbooks", href: "/app/handbooks", icon: BookOpen },
  { name: "Documents", href: "/app/documents", icon: FileText },
  { name: "News", href: "/app/news", icon: Newspaper },
];

const spaljistenNavItems: NavItem[] = [
  { name: "SP Dashboard", href: "/app/spaljisten/dashboard", icon: Target },
  { name: "SP Import", href: "/app/spaljisten/import", icon: Upload },
];

const settingsNavItems: NavItem[] = [
  { name: "Settings", href: "/app/settings", icon: Settings },
  { name: "Debug", href: "/app/debug", icon: Bug },
];

const pilotModeCoreNavItems: NavItem[] = [
  { name: "Employees", href: "/app/employees", icon: Users },
  { name: "Compliance", href: "/app/compliance", icon: ClipboardCheck },
];

const pilotModeHrNavItems: NavItem[] = [
  { name: "Compliance Summary", href: "/app/compliance/summary", icon: BarChart3, hrAdminOnly: true },
  { name: "Action Inbox", href: "/app/compliance/actions", icon: Inbox, hrAdminOnly: true },
  { name: "HR Inbox", href: "/app/hr", icon: Clipboard, hrAdminOnly: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser, loading: authLoading, isAuthenticated } = useAuth(true);
  const [user, setUser] = useState<CurrentUser | null>(null);
  
  const isDevMode = getSpaliDevMode();
  const isSpaljistenPage = pathname?.startsWith("/app/spaljisten");
  const isPilotMode = process.env.NEXT_PUBLIC_PILOT_MODE === "true";

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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // DEV MODE: Show ALL navigation including Spaljisten to ALL authenticated users
  // PROD MODE: Would check DB membership for Spaljisten org (not email domain)
  const showSpaljistenNav = isDevMode || isSpaljistenPage;

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
    const Icon = item.icon;

    return (
      <li key={item.name}>
        <Link
          href={item.href}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            isActive
              ? "bg-surface text-foreground border border-border"
              : "text-muted-foreground hover:bg-surface"
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
      <AppLayoutContent 
        pathname={pathname}
        authUser={authUser}
        user={user}
        handleSignOut={handleSignOut}
        isDevMode={isDevMode}
        showSpaljistenNav={showSpaljistenNav}
        isPilotMode={isPilotMode}
        renderNavItem={renderNavItem}
      >
        {children}
      </AppLayoutContent>
    </OrgProvider>
  );
}

/** Predicate: true when role can see HR Tools (Compliance Summary, Action Inbox, etc.). Same as /api/admin/me membership_role semantics. */
function canSeeHrTools(role: string | null | undefined): boolean {
  return isHrAdmin((role ?? "").toLowerCase());
}

function AppLayoutContent({
  pathname,
  authUser,
  user,
  handleSignOut,
  isDevMode,
  showSpaljistenNav,
  isPilotMode,
  renderNavItem,
  children,
}: {
  pathname: string | null;
  authUser: any;
  user: CurrentUser | null;
  handleSignOut: () => void;
  isDevMode: boolean;
  showSpaljistenNav: boolean;
  isPilotMode: boolean;
  renderNavItem: (item: NavItem) => JSX.Element;
  children: React.ReactNode;
}) {
  const { currentRole } = useOrg();
  const [membershipRoleFromApi, setMembershipRoleFromApi] = useState<string | null>(null);
  const [roleLoadStatus, setRoleLoadStatus] = useState<"loading" | "done">("loading");
  const isProduction = process.env.NODE_ENV === "production";
  const showVersionStrip = process.env.NEXT_PUBLIC_SHOW_VERSION_STRIP === "true";

  useEffect(() => {
    fetch("/api/admin/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json && typeof json.membership_role === "string") {
          setMembershipRoleFromApi(json.membership_role.trim());
        }
      })
      .catch(() => {})
      .finally(() => setRoleLoadStatus("done"));
  }, []);

  const roleForNav = (membershipRoleFromApi ?? currentRole ?? "").trim();

  const filterItems = (items: NavItem[], role: string) => {
    return items.filter((item) => {
      if (item.hrAdminOnly && !canSeeHrTools(role)) return false;
      return true;
    });
  };

  const visibleCoreItems = isPilotMode ? filterItems(pilotModeCoreNavItems, roleForNav) : filterItems(coreNavItems, roleForNav);
  const visibleHrItems = isPilotMode ? filterItems(pilotModeHrNavItems, roleForNav) : filterItems(hrNavItems, roleForNav);
  const visibleStrategicPlanningItems = isPilotMode ? [] : strategicPlanningNavItems;
  const visibleMoreItems = isPilotMode ? [] : moreNavItems;
  const visibleSpaljistenItems = isPilotMode ? [] : showSpaljistenNav ? spaljistenNavItems : [];
  const visibleSettingsItems = isPilotMode ? [] : filterItems(settingsNavItems, roleForNav).filter((item) => (isProduction && item.name === "Debug") ? false : true);

  const showHrToolsSection = roleLoadStatus === "loading" || visibleHrItems.length > 0;

  return (
    <>
      <GlobalErrorHandler />
      <div className="flex flex-col h-screen bg-background">
        <DemoModeBanner />
        {process.env.NODE_ENV !== "production" && <SessionDebugStrip />}
          <div className="flex flex-1 overflow-hidden">
          <aside className="w-64 bg-surface border-r border-border flex flex-col">
            <div className="p-6 border-b border-border">
              <h1 className="text-lg font-semibold text-foreground">
                Industrial Competence
              </h1>
              <p className="text-xs text-muted-foreground mt-1">Platform</p>
            </div>
            <nav className="flex-1 p-4 overflow-y-auto">
              {visibleCoreItems.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {COPY.nav.core}
                  </p>
                  <ul className="space-y-1">
                    {visibleCoreItems.map(renderNavItem)}
                  </ul>
                </div>
              )}

              {showHrToolsSection && (
                <div className="mb-4" data-testid="nav-hr-tools-section">
                  <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    HR Tools
                  </p>
                  {roleLoadStatus === "loading" ? (
                    <ul className="space-y-1" aria-busy="true">
                      {[1, 2, 3, 4].map((i) => (
                        <li key={i}>
                          <Skeleton className="h-9 w-full" />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="space-y-1">
                      {visibleHrItems.map(renderNavItem)}
                    </ul>
                  )}
                </div>
              )}

              {visibleStrategicPlanningItems.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Strategic Planning
                  </p>
                  <ul className="space-y-1">
                    {visibleStrategicPlanningItems.map(renderNavItem)}
                  </ul>
                </div>
              )}

              {visibleMoreItems.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    More
                  </p>
                  <ul className="space-y-1">
                    {visibleMoreItems.map(renderNavItem)}
                  </ul>
                </div>
              )}

              {visibleSpaljistenItems.length > 0 && (
                <div className="mb-4">
                  <p className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Spaljisten
                  </p>
                  <ul className="space-y-1">
                    {visibleSpaljistenItems.map(renderNavItem)}
                  </ul>
                </div>
              )}

              {visibleSettingsItems.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <ul className="space-y-1">
                    {visibleSettingsItems.map(renderNavItem)}
                  </ul>
                </div>
              )}
            </nav>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6">
              <div className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-foreground" data-testid="text-user-email">
                  {authUser?.email || user?.email || "User"}
                </span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface rounded-md transition-colors border border-border"
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
            {showVersionStrip && <VersionStrip />}
            </div>
          </div>
        </div>
    </>
  );
}
