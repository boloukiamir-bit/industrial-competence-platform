"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  DollarSign
} from "lucide-react";

const navItems = [
  { name: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { name: "Competence Matrix", href: "/app/competence-matrix", icon: Grid3X3 },
  { name: "Tomorrow's Gaps", href: "/app/tomorrows-gaps", icon: AlertTriangle },
  { name: "Import Employees", href: "/app/import-employees", icon: Upload },
  { name: "Manager Risks", href: "/app/manager/risks", icon: ShieldAlert },
  { name: "Equipment", href: "/app/equipment", icon: Package },
  { name: "News", href: "/app/news", icon: Newspaper },
  { name: "Documents", href: "/app/documents", icon: FileText },
  { name: "Pricing", href: "/app/pricing", icon: DollarSign },
  { name: "Settings", href: "/app/settings", icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Industrial Competence
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Platform</p>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              const Icon = item.icon;
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
            })}
          </ul>
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
            <span className="text-sm text-gray-600 dark:text-gray-300">User</span>
            <div
              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600"
              data-testid="user-avatar-placeholder"
            />
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
