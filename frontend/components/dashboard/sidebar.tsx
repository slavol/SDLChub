"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, KanbanSquare, ListTodo, FileText, Settings, Users, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

const routes = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    color: "text-sky-500",
  },
  {
    label: "Active Board",
    icon: KanbanSquare,
    href: "/dashboard/board",
    color: "text-violet-500",
  },
  {
    label: "Backlog",
    icon: ListTodo,
    href: "/dashboard/backlog",
    color: "text-pink-700",
  },
  {
    label: "Wiki & Docs",
    icon: FileText,
    href: "/dashboard/wiki",
    color: "text-orange-700",
  },
  {
    label: "Team",
    icon: Users,
    href: "/dashboard/team",
    color: "text-emerald-500",
  },
  {
    label: "AI Advisor",
    icon: BrainCircuit,
    href: "/dashboard/ai-tools",
    color: "text-purple-400", // Culoarea AI-ului nostru
  },
  {
    label: "Settings",
    icon: Settings,
    href: "/dashboard/settings",
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="space-y-4 py-4 flex flex-col h-full bg-slate-950 text-white border-r border-slate-800">
      <div className="px-3 py-2 flex-1">
        <Link href="/dashboard" className="flex items-center pl-3 mb-14">
          <div className="relative w-8 h-8 mr-4">
            {/* Logo placeholder - poți pune un SVG aici */}
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg animate-pulse opacity-75"></div>
            <div className="relative bg-slate-900 w-full h-full rounded-lg border border-slate-700 flex items-center justify-center font-bold text-lg">
                S
            </div>
          </div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SDLC Hub
          </h1>
        </Link>
        <div className="space-y-1">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-slate-800/50 rounded-lg transition",
                pathname === route.href ? "text-white bg-slate-800" : "text-slate-400"
              )}
            >
              <div className="flex items-center flex-1">
                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                {route.label}
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* Footer Sidebar - Version */}
      <div className="px-3 py-2 text-xs text-slate-600 text-center">
        v2.0 Enterprise
      </div>
    </div>
  );
}