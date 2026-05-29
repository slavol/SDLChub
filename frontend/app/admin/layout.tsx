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
    icon: LayoutDashboard,
    tone: "text-blue-300",
  },
  {
    name: "Identity",
    description: "Users, access, admins",
    href: "/admin#users",
    icon: Users,
    tone: "text-cyan-300",
  },
  {
    name: "Project Registry",
    description: "Archive and deletion",
    href: "/admin#projects",
    icon: FolderKanban,
    tone: "text-emerald-300",
  },
  {
    name: "Support Desk",
    description: "Queue and replies",
    href: "/admin#support",
    icon: Ticket,
    tone: "text-amber-300",
  },
  {
    name: "AI Usage",
    description: "Gemini audit trail",
    href: "/admin#ai-usage",
    icon: Activity,
    tone: "text-violet-300",
  },
  {
    name: "System Health",
    description: "HTTP error stream",
    href: "/admin#errors",
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
    <div className="flex h-screen overflow-hidden bg-[#050814] text-slate-100">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-800 bg-[#080c18]">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-800 p-4">
            <div className="mb-4 flex items-center gap-3">
              <BrandMark className="h-11 w-11 rounded-xl" />
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
              className="mb-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </button>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-200">
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

          <div className="shrink-0 border-b border-slate-800 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Users
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.users ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Projects
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.projects ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                  Tickets
                </p>
                <p className="mt-1 text-xl font-semibold text-white">
                  {overview?.open_tickets ?? "-"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
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

                return (
                  <Link key={link.href} href={link.href}>
                    <div className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-400 transition hover:border-slate-800 hover:bg-slate-950/70 hover:text-white">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-950">
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
              <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
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

          <div className="shrink-0 border-t border-slate-800 p-3">
            <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
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

      <main className="flex-1 overflow-y-auto bg-[#050814]">{children}</main>
    </div>
  );
}
