"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  ServerCrash,
  Ticket,
  Users,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import {
  AdminOverview,
  getAdminOverview,
} from "@/services/admin";
import { getCurrentUser } from "@/services/auth";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const links = [
  {
    name: "Command Center",
    description: "Live platform state",
    href: "/admin",
    id: "command",
    icon: LayoutDashboard,
    tone: "text-blue-300",
  },
  {
    name: "Identity",
    description: "Users, access, admins",
    href: "/admin#users",
    id: "users",
    icon: Users,
    tone: "text-cyan-300",
  },
  {
    name: "Project Registry",
    description: "Archive and deletion",
    href: "/admin#projects",
    id: "projects",
    icon: FolderKanban,
    tone: "text-emerald-300",
  },
  {
    name: "Support Desk",
    description: "Queue and replies",
    href: "/admin#support",
    id: "support",
    icon: Ticket,
    tone: "text-amber-300",
  },
  {
    name: "AI Usage",
    description: "Gemini audit trail",
    href: "/admin#ai-usage",
    id: "ai-usage",
    icon: Activity,
    tone: "text-violet-300",
  },
  {
    name: "System Health",
    description: "HTTP error stream",
    href: "/admin#errors",
    id: "errors",
    icon: ServerCrash,
    tone: "text-red-300",
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const { clearCurrentProject } = useProjectStore();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [activeArea, setActiveArea] = useState("command");

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (!currentUser.is_global_admin) {
          router.replace("/dashboard");
          return;
        }

        const overviewData = await getAdminOverview();
        setOverview(overviewData);
      } catch {
        router.replace("/login");
        return;
      } finally {
        setCheckingAccess(false);
      }
    };

    verifyAccess();
  }, [router, setUser]);

  useEffect(() => {
    const syncHash = () => {
      const currentHash = window.location.hash.replace("#", "");
      setActiveArea(currentHash || "command");
    };

    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const scrollRoot = document.getElementById("admin-scroll-root");
    if (!scrollRoot) return;

    const sectionIds = links.map((link) => link.id);
    let frame = 0;

    const updateActiveSection = () => {
      if (frame) return;

      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const rootTop = scrollRoot.getBoundingClientRect().top;
        let nextActive = sectionIds[0];

        for (const sectionId of sectionIds) {
          const section = document.getElementById(sectionId);
          if (!section) continue;

          const sectionTop = section.getBoundingClientRect().top - rootTop;
          if (sectionTop <= 170) {
            nextActive = sectionId;
          }
        }

        setActiveArea(nextActive);
      });
    };

    updateActiveSection();
    scrollRoot.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });
    window.addEventListener("resize", updateActiveSection);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scrollRoot.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, []);

  const handleSignOut = () => {
    clearCurrentProject();
    logout();
    router.push("/");
  };

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050712] text-slate-100">
      <aside className="hidden w-[296px] shrink-0 flex-col border-r border-slate-800/80 bg-[#080d1a] lg:flex">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-800/80 p-4">
            <div className="mb-4 flex items-center gap-3">
              <BrandMark className="h-11 w-11 rounded-2xl" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  SDLC Hub
                </p>
                <p className="truncate text-[11px] uppercase tracking-[0.18em] text-blue-300">
                  Global Admin
                </p>
              </div>
            </div>

            <button
              type="button"
              className="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/20 text-sm font-semibold text-blue-100 transition hover:border-blue-400/50 hover:bg-blue-600/30"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </button>

            <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
                  <Gauge className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">
                    Platform Control
                  </p>
                  <p className="truncate text-xs text-emerald-200/80">
                    {overview?.ai_configured ? "Operational · AI configured" : "Operational · AI fallback"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-b border-slate-800/80 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Users
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.users ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Projects
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.projects ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Tickets
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.open_tickets ?? "-"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Errors
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.errors_last_24h ?? "-"}
                </p>
              </div>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">
              Work areas
            </div>
            <div className="space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = activeArea === link.id;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setActiveArea(link.id)}
                  >
                    <div
                      className={
                        isActive
                          ? "group flex items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-600/15 px-3 py-2.5 text-sm text-white shadow-lg shadow-blue-950/20 transition"
                          : "group flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-sm text-slate-400 transition hover:border-slate-800 hover:bg-slate-950/70 hover:text-white"
                      }
                    >
                      <span
                        className={
                          isActive
                            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-400/30 bg-blue-500/15"
                            : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-950"
                        }
                      >
                        <Icon className={`h-4 w-4 ${link.tone}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {link.name}
                        </span>
                        <span className="block truncate text-xs text-slate-500">
                          {link.description}
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>

            {(overview?.errors_last_24h ?? 0) > 0 && (
              <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-200" />
                  <p className="text-xs leading-5 text-amber-100/90">
                    {overview?.errors_last_24h} HTTP errors were captured in the
                    last 24 hours.
                  </p>
                </div>
              </div>
            )}
          </nav>

          <div className="shrink-0 border-t border-slate-800/80 p-3">
            <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
              <UserAvatar
                name={user?.full_name || "Admin"}
                email={user?.email}
                src={resolveMediaUrl(user?.avatar_url)}
                className="h-10 w-10 shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">
                  {user?.full_name || "Global Admin"}
                </p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
            </div>

            <Button
              variant="ghost"
              className="h-10 w-full justify-start rounded-xl text-slate-400 hover:bg-red-950/20 hover:text-red-400"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#050712]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-800/80 bg-[#080d1a]/95 px-4 py-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="h-10 w-10 rounded-xl" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                Global Admin
              </p>
              <p className="truncate text-xs text-slate-500">
                {user?.full_name || user?.email || "SDLC Hub"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-red-500/25 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div
          id="admin-scroll-root"
          className="min-h-0 flex-1 overflow-y-auto scroll-smooth"
        >
          {children}
        </div>
      </main>
    </div>
  );
}
