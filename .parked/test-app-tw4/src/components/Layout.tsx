import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { Bug, Home, Zap, Code2, MousePointerClick, AppWindow } from "lucide-react";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/quick-start", label: "Quick Start", icon: Zap },
  { to: "/hook-demo", label: "Hook Demo", icon: MousePointerClick },
  { to: "/headless", label: "Headless API", icon: Code2 },
  { to: "/sample-app", label: "Sample App", icon: AppWindow },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
          <Bug className="size-6 text-indigo-600" />
          <span className="text-lg font-bold tracking-tight">
            quick-bug-reporter-react
          </span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 px-5 py-3 text-xs text-gray-400">
          Test App &middot; v0.1.0
        </div>
      </aside>

      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}
