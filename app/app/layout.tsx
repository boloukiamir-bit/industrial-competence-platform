"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutDashboard,
  Grid3X3,
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
  Lightbulb,
  User,
} from "lucide-react";
import { getCurrentUser, type CurrentUser, isHrAdmin } from "@/lib/auth";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/services/auth";
import { OrgProvider } from "@/components/OrgProvider";
import { OrgIdentityProvider } from "@/contexts/OrgIdentityContext";
import { OrgIdentity } from "@/components/nav/OrgIdentity";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { SessionDebugStrip } from "@/components/SessionDebugStrip";
import { VersionStrip } from "@/components/VersionStrip";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COPY } from "@/lib/copy";
import { getSpaliDevMode } from "@/lib/spaliDevMode";
import { cn } from "@/lib/utils";

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
  { name: "HR Templates", href: "/app/hr/templates", icon: FileText, hrAdminOnly: true },
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
  { name: "HR Templates", href: "/app/hr/templates", icon: FileText, hrAdminOnly: true },
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
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              href={item.href}
              className={cn(
                "flex items-center justify-center w-full h-10 rounded-r-md text-sm font-medium transition-colors border-l-2",
                isActive
                  ? "bg-muted text-foreground border-l-primary"
                  : "border-l-transparent text-muted-foreground hover:bg-muted/70"
              )}
              data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <Icon className="h-5 w-5 shrink-0" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="font-normal">
            {item.name}
          </TooltipContent>
        </Tooltip>
      </li>
    );
  };

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={0}>
      <OrgProvider>
        <OrgIdentityProvider>
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
        </OrgIdentityProvider>
      </OrgProvider>
    </TooltipProvider>
  );
}

/** Predicate: true when role can see HR Tools (HR Templates, Compliance Summary, Action Inbox, etc.). Includes admin and hr. Same as /api/admin/me membership_role semantics. */
function canSeeHrTools(role: string | null | undefined): boolean {
  return isHrAdmin((role ?? "").toLowerCase());
}

function initials(email: string | null | undefined, displayName?: string | null): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
    return displayName.slice(0, 2).toUpperCase();
  }
  if (email) {
    const local = email.split("@")[0] || "";
    return local.slice(0, 2).toUpperCase();
  }
  return "?";
}

function SidebarUserCard({
  authUser,
  user,
  roleForNav,
  onSignOut,
}: {
  authUser: any;
  user: CurrentUser | null;
  roleForNav: string;
  onSignOut: () => void;
}) {
  const displayName = (authUser?.user_metadata as { name?: string } | undefined)?.name ?? null;
  const email = authUser?.email ?? user?.email ?? "";
  const initial = initials(email, displayName);
  const label = displayName && displayName.trim() ? displayName.trim() : email || "User";

  return (
    <DropdownMenu.Root>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-center rounded-md p-1.5 hover:bg-muted/70 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              data-testid="sidebar-user-trigger"
              aria-label="User menu"
            >
              <span
                className="h-9 w-9 shrink-0 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground"
                aria-hidden
              >
                {initial}
              </span>
            </button>
          </DropdownMenu.Trigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <span className="font-medium">{label}</span>
          {roleForNav && <span className="block text-xs text-muted-foreground mt-0.5">{roleForNav}</span>}
        </TooltipContent>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="right"
          sideOffset={8}
          align="end"
          className="min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-b border-border mb-1">
            {label}
            {roleForNav && (
              <span className="block mt-0.5 font-medium text-foreground/80">{roleForNav}</span>
            )}
          </div>
          <DropdownMenu.Item disabled className="cursor-not-allowed text-muted-foreground">
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={(e) => {
              e.preventDefault();
              onSignOut();
            }}
            className="text-destructive focus:text-destructive focus:bg-destructive/10"
            data-testid="dropdown-signout"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
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
          <aside className="w-16 shrink-0 bg-surface border-r border-border flex flex-col">
            <div className="h-14 shrink-0 flex items-center justify-center border-b border-border">
              <Tooltip delayDuration={200}>
                <TooltipTrigger asChild>
                  <Link href="/app/cockpit" className="flex items-center justify-center w-10 h-10 rounded-md text-foreground hover:bg-muted/70" aria-label="Industrial Competence Platform">
                    <Gauge className="h-6 w-6" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>Industrial Competence Platform</TooltipContent>
              </Tooltip>
            </div>
            <nav className="flex-1 py-3 overflow-y-auto flex flex-col items-stretch">
              {visibleCoreItems.length > 0 && (
                <ul className="space-y-0.5 px-2">
                  {visibleCoreItems.map(renderNavItem)}
                </ul>
              )}

              {showHrToolsSection && (
                <>
                  <div className="my-2 border-t border-border shrink-0" aria-hidden />
                  <div data-testid="nav-hr-tools-section">
                    {roleLoadStatus === "loading" ? (
                      <ul className="space-y-0.5 px-2" aria-busy="true">
                        {[1, 2, 3].map((i) => (
                          <li key={i}>
                            <Skeleton className="h-10 w-full rounded-r-md" />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <ul className="space-y-0.5 px-2">
                        {visibleHrItems.map(renderNavItem)}
                      </ul>
                    )}
                  </div>
                </>
              )}

              {visibleStrategicPlanningItems.length > 0 && (
                <>
                  <div className="my-2 border-t border-border shrink-0" aria-hidden />
                  <ul className="space-y-0.5 px-2">
                    {visibleStrategicPlanningItems.map(renderNavItem)}
                  </ul>
                </>
              )}

              {visibleMoreItems.length > 0 && (
                <>
                  <div className="my-2 border-t border-border shrink-0" aria-hidden />
                  <ul className="space-y-0.5 px-2">
                    {visibleMoreItems.map(renderNavItem)}
                  </ul>
                </>
              )}

              {visibleSpaljistenItems.length > 0 && (
                <>
                  <div className="my-2 border-t border-border shrink-0" aria-hidden />
                  <ul className="space-y-0.5 px-2">
                    {visibleSpaljistenItems.map(renderNavItem)}
                  </ul>
                </>
              )}

              {visibleSettingsItems.length > 0 && (
                <>
                  <div className="my-2 border-t border-border shrink-0" aria-hidden />
                  <ul className="space-y-0.5 px-2">
                    {visibleSettingsItems.map(renderNavItem)}
                  </ul>
                </>
              )}
            </nav>

            <div className="shrink-0 border-t border-border p-2">
              <SidebarUserCard
                authUser={authUser}
                user={user}
                roleForNav={roleForNav}
                onSignOut={handleSignOut}
              />
            </div>
          </aside>

          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="h-14 shrink-0 bg-surface border-b border-border flex items-center justify-between px-6 gap-4">
              <OrgIdentity />
              <div className="text-sm text-muted-foreground shrink-0" data-testid="header-date">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
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
