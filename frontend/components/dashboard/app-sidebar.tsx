"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  Gauge,
  BarChart3,
  Bell,
  BookOpen,
  Github,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareWarning,
  PlusCircle,
  Settings,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import { getMyProjects, Project } from "@/services/project";
import { getUnreadNotificationCount } from "@/services/notification";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

interface SidebarProps {
  methodology: string;
  role: string;
  projectName?: string;
}

function getInitials(value?: string | null, fallback = "PR") {
  if (!value) return fallback;

  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return fallback;

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function getProjectMark(project?: Project | null) {
  if (!project) return "PR";

  return (
    project.key?.slice(0, 2).toUpperCase() ||
    getInitials(project.name, "PR")
  );
}

export function AppSidebar({ methodology, role, projectName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const { logout, user } = useAuthStore();
  const { currentProject, hasHydrated, setCurrentProject, clearCurrentProject } =
    useProjectStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDrawerMounted, setMobileDrawerMounted] = useState(false);
  const mobileCloseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    const loadProjects = async () => {
      setLoadingProjects(true);

      try {
        const remoteProjects = await getMyProjects();
        setProjects(remoteProjects);

        if (remoteProjects.length === 0) {
          clearCurrentProject();
          return;
        }

        const stillAvailable = currentProject
          ? remoteProjects.some((project) => project.id === currentProject.id)
          : false;

        if (!currentProject || !stillAvailable) {
          setCurrentProject(remoteProjects[0]);
        }
      } catch {
        setProjects([]);
      } finally {
        setLoadingProjects(false);
      }
    };

    loadProjects();
  }, [clearCurrentProject, currentProject, hasHydrated, setCurrentProject]);

  useEffect(() => {
    const loadUnreadNotifications = async () => {
      try {
        const count = await getUnreadNotificationCount();
        setUnreadNotifications(count);
      } catch {
        setUnreadNotifications(0);
      }
    };

    loadUnreadNotifications();

    const intervalId = window.setInterval(loadUnreadNotifications, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useRealtimeEvent((message) => {
    if (
      message.type === "notification.created" ||
      message.type === "notification.read" ||
      message.type === "notification.read_all"
    ) {
      getUnreadNotificationCount()
        .then(setUnreadNotifications)
        .catch(() => setUnreadNotifications(0));
    }
  }, []);

  const openMobileDrawer = useCallback(() => {
    if (mobileCloseTimeoutRef.current !== null) {
      window.clearTimeout(mobileCloseTimeoutRef.current);
      mobileCloseTimeoutRef.current = null;
    }
    setMobileDrawerMounted(true);
    window.requestAnimationFrame(() => setMobileOpen(true));
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileOpen(false);
    if (mobileCloseTimeoutRef.current !== null) {
      window.clearTimeout(mobileCloseTimeoutRef.current);
    }
    mobileCloseTimeoutRef.current = window.setTimeout(() => {
      setMobileDrawerMounted(false);
      mobileCloseTimeoutRef.current = null;
    }, 220);
  }, []);

  useEffect(() => {
    closeMobileDrawer();
  }, [pathname, closeMobileDrawer]);

  useEffect(() => {
    if (!mobileDrawerMounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileDrawerMounted]);

  useEffect(() => {
    return () => {
      if (mobileCloseTimeoutRef.current !== null) {
        window.clearTimeout(mobileCloseTimeoutRef.current);
      }
    };
  }, []);

  const activeProject = useMemo(() => {
    if (!currentProject) return null;

    return (
      projects.find((project) => project.id === currentProject.id) ||
      currentProject
    );
  }, [currentProject, projects]);

  const activeMethodology = activeProject?.methodology || methodology;
  const activeProjectName =
    activeProject?.name || projectName || "Select workspace";
  const activeProjectKey = activeProject?.key || "NO-KEY";

  const displayName = user?.full_name || "User";
  const projectInitials = getProjectMark(activeProject);

  const isScrum =
    activeMethodology === "SCRUM" || activeMethodology === "SCRUMBAN";
  const isAdmin = ["Owner", "Admin", "Project Admin"].includes(role);

  const links = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Workload", href: "/dashboard/workload", icon: Gauge },
    { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { name: "Documentation", href: "/dashboard/documentation", icon: BookOpen },
    { name: "DevOps", href: "/dashboard/devops", icon: Github },
    { name: "Activity", href: "/dashboard/activity", icon: Activity },
    { name: "Calendar", href: "/dashboard/calendar", icon: CalendarDays },
    { name: "Board", href: "/dashboard/board", icon: KanbanSquare },
    { name: "Tasks", href: "/dashboard/tasks", icon: ListChecks },
    ...(isScrum
      ? [{ name: "Backlog", href: "/dashboard/backlog", icon: FileText }]
      : []),
    { name: "Team", href: "/dashboard/team", icon: Users },
    { name: "Support", href: "/dashboard/support", icon: MessageSquareWarning },
    ...(isAdmin
      ? [{ name: "Settings", href: "/dashboard/settings", icon: Settings }]
      : []),
  ];

  const handleProjectChange = (project: Project) => {
    setCurrentProject(project);
    router.push("/dashboard");
    router.refresh();
  };

  const handleCreateProject = () => {
    router.push("/project-wizard");
  };

  const handleSignOut = () => {
    clearCurrentProject();
    logout();
    router.push("/");
  };

  const avatarUrl = resolveMediaUrl(user?.avatar_url);

  const sidebarBody = (
    <>
      <div className="shrink-0 border-b border-slate-800 px-3.5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-9 w-9 shrink-0 rounded-xl" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold leading-tight text-white">
                SDLC Hub
              </h2>
              <p className="truncate text-xs text-slate-500">
                Adaptive project workspace
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/notifications"
            title={
              unreadNotifications > 0
                ? `${unreadNotifications} unread notifications`
                : "Notifications"
            }
            className={cn(
              "relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 md:flex",
              pathname.startsWith("/dashboard/notifications")
                ? "border-blue-500/40 bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                : "border-slate-800 bg-slate-900/70 text-slate-400 hover:border-blue-500/35 hover:bg-slate-900 hover:text-white"
            )}
          >
            <Bell className="h-4 w-4" />

            {unreadNotifications > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-slate-950">
                {unreadNotifications > 99 ? "99+" : unreadNotifications}
              </span>
            )}
          </Link>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="mt-3 w-full rounded-2xl border border-slate-800 bg-slate-900/70 p-2.5 text-left transition hover:border-blue-500/35 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-[11px] font-bold text-blue-200">
                  {projectInitials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-white">
                      {loadingProjects ? "Loading workspace..." : activeProjectName}
                    </p>
                  </div>
                  <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                    <span className="truncate">{activeProjectKey}</span>
                    <span>·</span>
                    <span className="truncate">{activeMethodology}</span>
                  </div>
                </div>

                <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            align="start"
            sideOffset={8}
            className="w-[240px] border-slate-800 bg-slate-950 p-2 text-slate-100 shadow-2xl shadow-slate-950/40"
          >
            <DropdownMenuLabel className="px-2 text-xs uppercase tracking-wide text-slate-500">
              Workspaces
            </DropdownMenuLabel>

            <div className="max-h-64 overflow-y-auto py-1">
              {projects.map((project) => {
                const selected = activeProject?.id === project.id;

                return (
                  <DropdownMenuItem
                    key={project.id}
                    onSelect={() => handleProjectChange(project)}
                    className="cursor-pointer rounded-xl px-2 py-2 text-slate-200 focus:bg-slate-900 focus:text-white"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-[10px] font-bold text-slate-300">
                      {getProjectMark(project)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {project.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {project.key} · {project.methodology}
                      </p>
                    </div>
                    {selected && <Check className="h-4 w-4 text-blue-300" />}
                  </DropdownMenuItem>
                );
              })}

              {!loadingProjects && projects.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-500">
                  No project workspace yet.
                </div>
              )}
            </div>

            <DropdownMenuSeparator className="bg-slate-800" />

            <DropdownMenuItem
              onSelect={handleCreateProject}
              className="cursor-pointer rounded-xl px-2 py-2 text-blue-300 focus:bg-blue-500/10 focus:text-blue-200"
            >
              <PlusCircle className="h-4 w-4" />
              Create new project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <nav className="sdlc-hide-scrollbar min-h-0 flex-1 overflow-y-auto px-2.5 py-3">
        <div className="mb-2 px-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">
          Navigation
        </div>

        <div className="space-y-0.5">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              link.href === "/dashboard"
                ? pathname === link.href
                : pathname.startsWith(link.href);

            return (
              <Link key={link.href} href={link.href}>
                <div
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition",
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                      : "text-slate-400 hover:bg-slate-900 hover:text-white"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition",
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-300"
                    )}
                  />
                  <span className="font-medium">{link.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-slate-800 p-3">
        <Link
          href="/dashboard/account"
          className="mb-2.5 flex items-center gap-2.5 rounded-2xl border border-slate-800 bg-slate-900/60 p-2.5 transition hover:border-blue-500/35 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <UserAvatar
            name={displayName}
            email={user?.email}
            src={avatarUrl}
            className="h-9 w-9 shrink-0"
          />

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {displayName}
            </p>
            <p className="truncate text-xs text-slate-500">{user?.email}</p>
          </div>
        </Link>

        {user?.is_global_admin && (
          <Link
            href="/admin"
            className="mb-2.5 flex items-center gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-2.5 py-2 text-[13px] font-semibold text-blue-200 transition hover:border-blue-400/40 hover:bg-blue-500/15"
          >
            <ShieldCheck className="h-4 w-4" />
            Global Admin Console
          </Link>
        )}

        <ThemeModeToggle className="mb-2.5" />

        <Button
          variant="ghost"
          className="h-9 w-full justify-start rounded-xl text-[13px] text-slate-400 hover:bg-red-950/20 hover:text-red-400"
          onClick={handleSignOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </>
  );

  return (
    <>
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3 py-3 text-slate-200 md:hidden">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl border-slate-800 bg-slate-900/70 text-slate-200 hover:bg-slate-900"
          onClick={openMobileDrawer}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BrandMark className="h-9 w-9 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">SDLC Hub</p>
            <p className="truncate text-xs text-slate-500">
              {activeProjectName}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-slate-400"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-slate-950">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </Link>
      </header>

      {mobileDrawerMounted && (
        <div
          className={cn(
            "fixed inset-0 z-50 md:hidden",
            mobileOpen ? "pointer-events-auto" : "pointer-events-none"
          )}
        >
          <button
            type="button"
            aria-label="Close navigation"
            className={cn(
              "absolute inset-0 bg-slate-950/65 backdrop-blur-sm transition-opacity duration-200 ease-out",
              mobileOpen ? "opacity-100" : "opacity-0"
            )}
            onClick={closeMobileDrawer}
          />
          <aside
            className={cn(
              "relative flex h-dvh w-[min(21rem,calc(100vw-2rem))] flex-col border-r border-slate-800 bg-slate-950 text-slate-200 shadow-2xl shadow-slate-950/60 transition-transform duration-200 ease-out will-change-transform",
              mobileOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute right-3 top-3 z-10 h-9 w-9 rounded-xl border-slate-800 bg-slate-900/80 text-slate-300 hover:bg-slate-900"
              onClick={closeMobileDrawer}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </Button>
            {sidebarBody}
          </aside>
        </div>
      )}

      <aside className="hidden h-dvh w-[258px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-200 md:flex">
        {sidebarBody}
      </aside>
    </>
  );
}
