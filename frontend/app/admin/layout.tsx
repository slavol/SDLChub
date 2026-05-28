"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  Loader2,
  LogOut,
  ServerCrash,
  ShieldCheck,
  Ticket,
  Users,
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/services/auth";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const links = [
  {
    name: "Command Center",
    description: "Platform health",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    name: "Identity",
    description: "Users and access",
    href: "/admin#users",
    icon: Users,
  },
  {
    name: "Project Registry",
    description: "All workspaces",
    href: "/admin#projects",
    icon: FolderKanban,
  },
  {
    name: "Support Desk",
    description: "Tickets and replies",
    href: "/admin#support",
    icon: Ticket,
  },
  {
    name: "System Health",
    description: "HTTP errors",
    href: "/admin#errors",
    icon: ServerCrash,
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();
  const { clearCurrentProject } = useProjectStore();
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);

        if (!currentUser.is_global_admin) {
          router.replace("/dashboard");
          return;
        }
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
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
        <div className="border-b border-slate-800 p-5">
          <div className="flex items-center gap-3">
            <BrandMark className="h-11 w-11 rounded-2xl" />
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">
                SDLC Hub
              </p>
              <p className="truncate text-xs uppercase tracking-[0.22em] text-blue-300">
                Global Admin
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-blue-500/25 bg-blue-500/10">
            <div className="border-b border-blue-500/15 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-200" />
                <div>
                  <p className="text-sm font-semibold text-white">
                    Separate Admin Surface
                  </p>
                  <p className="text-xs text-slate-400">
                    Nu depinde de proiectul curent
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-blue-500/10">
              <div className="p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-300">
                  Scope
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Platform
                </p>
              </div>
              <div className="p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-blue-300">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Global
                </p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">
            Operations
          </div>
          <div className="space-y-1">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive =
                link.href === "/admin" ? pathname === "/admin" : false;

              return (
                <Link key={link.href} href={link.href}>
                  <div
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-950/25"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                        isActive
                          ? "border-blue-400/40 bg-blue-500/20"
                          : "border-slate-800 bg-slate-900/70 group-hover:border-slate-700"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {link.name}
                      </span>
                      <span
                        className={cn(
                          "block truncate text-xs",
                          isActive ? "text-blue-100" : "text-slate-500"
                        )}
                      >
                        {link.description}
                      </span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <UserAvatar
              name={user?.full_name || "Admin"}
              email={user?.email}
              src={resolveMediaUrl(user?.avatar_url)}
              className="h-11 w-11 shrink-0"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {user?.full_name || "Global Admin"}
              </p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="mb-2 flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-400 transition hover:bg-slate-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Link>

          <Button
            variant="ghost"
            className="h-10 w-full justify-start rounded-xl text-slate-400 hover:bg-red-950/20 hover:text-red-400"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-950">{children}</main>
    </div>
  );
}
