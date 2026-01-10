"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  KanbanSquare, 
  Settings, 
  Users, 
  FileText, 
  LogOut, 
  CalendarDays,
  ShieldAlert,
  GitPullRequest
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/use-auth-store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarProps {
    methodology: string;
    role: string;
    projectName?: string;
}

export function AppSidebar({ methodology, role, projectName }: SidebarProps) {
  const pathname = usePathname();
  const { logout, user } = useAuthStore();

  // --- POLYMORPHIC LOGIC ---
  const isScrum = methodology === "SCRUM" || methodology === "SCRUMBAN";
  const isAdmin = role === "Owner" || role === "Admin"; 

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Board", href: "/dashboard/board", icon: KanbanSquare },
    // Only show Backlog for Scrum/Scrumban
    ...(isScrum ? [{ name: "Backlog", href: "/dashboard/backlog", icon: FileText }] : []),
    { name: "Team", href: "/dashboard/team", icon: Users },
    { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
    { name: "Risks & PRs", href: "/dashboard/risks", icon: ShieldAlert },
    ...(isAdmin ? [{ name: "Settings", href: "/dashboard/settings", icon: Settings }] : []),
  ];

  return (
    <div className="flex flex-col h-screen w-64 bg-slate-950 border-r border-slate-800 text-slate-200 shrink-0">
      {/* Identity Area */}
      <div className="p-6 border-b border-slate-900">
        <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">
                SD
            </div>
            <div className="overflow-hidden">
                <h2 className="font-bold text-lg tracking-tight leading-none text-white">SDLC Hub</h2>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1 truncate">{projectName || "Workspace"}</p>
            </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
                <Link key={link.href} href={link.href}>
                    <div className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
                        isActive 
                            ? "bg-blue-600/10 text-blue-400" 
                            : "hover:bg-slate-900 hover:text-white text-slate-400"
                    )}>
                        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />}
                        <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300")} />
                        <span className="font-medium">{link.name}</span>
                    </div>
                </Link>
            );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-slate-900 bg-slate-950/50">
        <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarFallback className="bg-gradient-to-tr from-slate-800 to-slate-700 text-slate-200">
                    {user?.full_name?.charAt(0) || "U"}
                </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate text-white">{user?.full_name}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
        </div>
        <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-red-400 hover:bg-red-950/10 h-9" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign Out
        </Button>
      </div>
    </div>
  );
}