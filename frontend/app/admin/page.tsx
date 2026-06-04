"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArchiveRestore,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  FolderKanban,
  Gauge,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Search,
  ServerCrash,
  ShieldCheck,
  Send,
  SlidersHorizontal,
  Ticket,
  Trash2,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  AdminOverview,
  AdminProject,
  AdminUser,
  AiUsageLog,
  createSupportTicketComment,
  deleteAdminProject,
  deleteSupportTicket,
  deleteSupportTicketComment,
  downloadAdminCsv,
  downloadAdminPlatformPdf,
  getAdminAiUsage,
  getAdminErrors,
  getAdminOverview,
  getAdminProjects,
  getAdminTickets,
  getAdminUsers,
  HttpErrorLog,
  SupportTicket,
  updateAdminProjectArchive,
  updateAdminTicket,
  updateAdminUser,
} from "@/services/admin";
import { useAuthStore } from "@/store/use-auth-store";

const statusStyles: Record<string, string> = {
  OPEN: "border-amber-500/35 bg-amber-500/10 text-amber-200",
  IN_PROGRESS: "border-blue-500/35 bg-blue-500/10 text-blue-200",
  RESOLVED: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  CLOSED: "border-slate-500/35 bg-slate-500/10 text-slate-300",
};

const ticketStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function parseErrorDetail(detail?: string | null): Record<string, unknown> {
  if (!detail) return {};

  try {
    const parsed = JSON.parse(detail);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { detail: parsed };
  } catch {
    return { detail };
  }
}

function formatErrorDetailValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "None";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  const tones = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-200",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    red: "border-red-500/25 bg-red-500/10 text-red-200",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  };

  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-950/75 p-4 shadow-xl shadow-slate-950/20 transition hover:border-slate-700 hover:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-white">
          {value}
        </p>
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function AdminConsoleSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1560px] space-y-6 p-4 text-slate-100 sm:p-5 xl:p-7">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/75 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 border-b border-slate-800 bg-slate-900/35 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-48 rounded-full" />
              <Skeleton className="h-10 w-80 max-w-full" />
              <Skeleton className="h-5 w-[34rem] max-w-full" />
            </div>
          </div>
          <div className="w-full space-y-3 xl:w-[560px]">
            <Skeleton className="h-12 rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Skeleton className="h-60 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {Array.from({ length: 2 }).map((_, panelIndex) => (
          <div key={panelIndex} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 p-5">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            </div>
            <div className="divide-y divide-slate-800">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-4 p-5 lg:grid-cols-[1fr_10rem_10rem]">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-64 max-w-full" />
                    <Skeleton className="h-4 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-10 rounded-xl" />
                  <Skeleton className="h-10 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default function AdminConsolePage() {
  const currentUser = useAuthStore((state) => state.user);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [errors, setErrors] = useState<HttpErrorLog[]>([]);
  const [aiUsage, setAiUsage] = useState<AiUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState("ALL");
  const [errorFilter, setErrorFilter] = useState("ALL");
  const [projectStatusFilter, setProjectStatusFilter] = useState("ACTIVE");
  const [aiFeatureFilter, setAiFeatureFilter] = useState("ALL");
  const [aiStatusFilter, setAiStatusFilter] = useState("ALL");
  const [aiProjectFilter, setAiProjectFilter] = useState("ALL");
  const [aiTimeFilter, setAiTimeFilter] = useState("ALL");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [supportTicketToDelete, setSupportTicketToDelete] = useState<SupportTicket | null>(null);
  const [supportCommentToDelete, setSupportCommentToDelete] = useState<{
    ticket: SupportTicket;
    commentId: number;
  } | null>(null);
  const [selectedError, setSelectedError] = useState<HttpErrorLog | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<AdminProject | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [projectActionId, setProjectActionId] = useState<number | null>(null);
  const [deletingSupportTicket, setDeletingSupportTicket] = useState(false);
  const [deletingSupportComment, setDeletingSupportComment] = useState(false);
  const deferredQuery = useDeferredValue(query);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        overviewData,
        projectData,
        userData,
        ticketData,
        errorData,
        aiUsageData,
      ] = await Promise.all([
        getAdminOverview(),
        getAdminProjects(),
        getAdminUsers(),
        getAdminTickets(),
        getAdminErrors(),
        getAdminAiUsage(),
      ]);

      setOverview(overviewData);
      setProjects(projectData);
      setUsers(userData);
      setTickets(ticketData);
      setErrors(errorData);
      setAiUsage(aiUsageData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Admin data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const filteredUsers = useMemo(
    () =>
      users.filter((user) => {
        if (!normalizedQuery) return true;
        return `${user.full_name || ""} ${user.email}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, users]
  );

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const statusMatches =
          projectStatusFilter === "ALL" ||
          (projectStatusFilter === "ACTIVE" && !project.is_archived) ||
          (projectStatusFilter === "ARCHIVED" && project.is_archived);
        if (!statusMatches) return false;
        if (!normalizedQuery) return true;
        return `${project.name} ${project.key} ${project.methodology} ${project.owner_name || ""} ${project.owner_email || ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, projectStatusFilter, projects]
  );

  const filteredTickets = useMemo(
    () =>
      tickets.filter((ticket) => {
        const statusMatches =
          ticketFilter === "ALL" || ticket.status === ticketFilter;
        const queryMatches =
          !normalizedQuery ||
          `${ticket.title} ${ticket.description || ""} ${ticket.reporter_email || ""}`
            .toLowerCase()
            .includes(normalizedQuery);
        return statusMatches && queryMatches;
      }),
    [normalizedQuery, ticketFilter, tickets]
  );

  const focusSupportTicket = useCallback((ticketId?: number) => {
    if (ticketId) {
      setSelectedTicketId(ticketId);
    }

    setTicketFilter("ALL");
    window.history.replaceState(null, "", "/admin#support");
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    window.setTimeout(() => {
      const scrollRoot = document.getElementById("admin-scroll-root");
      const target = document.getElementById("support");

      if (scrollRoot && target && scrollRoot.scrollHeight > scrollRoot.clientHeight) {
        scrollRoot.scrollTo({
          top: Math.max(target.offsetTop - 18, 0),
          behavior: "smooth",
        });
        return;
      }

      target?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const filteredErrors = useMemo(
    () =>
      errors.filter((error) => {
        const severityMatches =
          errorFilter === "ALL" ||
          (errorFilter === "5XX" && error.status_code >= 500) ||
          (errorFilter === "4XX" &&
            error.status_code >= 400 &&
            error.status_code < 500);
        const queryMatches =
          !normalizedQuery ||
          `${error.method} ${error.path} ${error.status_code} ${error.user_name || ""} ${error.detail || ""}`
            .toLowerCase()
            .includes(normalizedQuery);
        return severityMatches && queryMatches;
      }),
    [errorFilter, errors, normalizedQuery]
  );

  const filteredAiUsage = useMemo(
    () =>
      aiUsage.filter((item) => {
        const queryMatches =
          !normalizedQuery ||
          `${item.feature} ${item.source || ""} ${item.user_name || ""} ${item.project_name || ""}`
            .toLowerCase()
            .includes(normalizedQuery);
        const featureMatches =
          aiFeatureFilter === "ALL" || item.feature === aiFeatureFilter;
        const statusMatches =
          aiStatusFilter === "ALL" || item.status === aiStatusFilter;
        const projectMatches =
          aiProjectFilter === "ALL" ||
          (aiProjectFilter === "NONE" && !item.project_id) ||
          String(item.project_id) === aiProjectFilter;
        const timeMatches =
          aiTimeFilter === "ALL" ||
          Boolean(
            item.created_at &&
              new Date(item.created_at).getTime() >=
                Date.now() - Number(aiTimeFilter) * 24 * 60 * 60 * 1000
          );

        return (
          queryMatches &&
          featureMatches &&
          statusMatches &&
          projectMatches &&
          timeMatches
        );
      }),
    [
      aiFeatureFilter,
      aiProjectFilter,
      aiStatusFilter,
      aiTimeFilter,
      aiUsage,
      normalizedQuery,
    ]
  );

  const aiFeatureOptions = useMemo(
    () => Array.from(new Set(aiUsage.map((item) => item.feature))).sort(),
    [aiUsage]
  );

  const aiProjectOptions = useMemo(() => {
    const map = new Map<number, string>();
    aiUsage.forEach((item) => {
      if (item.project_id) {
        map.set(item.project_id, item.project_name || `Project #${item.project_id}`);
      }
    });
    return Array.from(map.entries()).sort((first, second) =>
      first[1].localeCompare(second[1])
    );
  }, [aiUsage]);

  const resetAiFilters = () => {
    setAiFeatureFilter("ALL");
    setAiStatusFilter("ALL");
    setAiProjectFilter("ALL");
    setAiTimeFilter("ALL");
  };

  const globalAdmins = users.filter((user) => user.is_global_admin).length;
  const activeUsers = users.filter((user) => user.is_active).length;
  const activeProjects = projects.filter((project) => !project.is_archived).length;
  const archivedProjects = projects.length - activeProjects;
  const criticalTickets = tickets.filter((ticket) => ticket.priority === "CRITICAL").length;
  const serverErrors = errors.filter((error) => error.status_code >= 500).length;
  const openOrActiveTickets = tickets.filter((ticket) =>
    ["OPEN", "IN_PROGRESS"].includes(ticket.status)
  ).length;
  const selectedTicket = useMemo(
    () =>
      filteredTickets.find((ticket) => ticket.id === selectedTicketId) ||
      filteredTickets[0] ||
      null,
    [filteredTickets, selectedTicketId]
  );
  const selectedErrorDetails = useMemo(
    () => parseErrorDetail(selectedError?.detail),
    [selectedError?.detail]
  );
  const topIncidents = filteredTickets
    .filter((ticket) =>
      ["OPEN", "IN_PROGRESS"].includes(ticket.status)
    )
    .slice(0, 4);
  const ticketStatusCounts = ticketStatuses.reduce<Record<string, number>>(
    (accumulator, status) => {
      accumulator[status] = tickets.filter((ticket) => ticket.status === status).length;
      return accumulator;
    },
    {}
  );

  const handleTicketStatus = async (ticket: SupportTicket, status: string) => {
    try {
      const updated = await updateAdminTicket(ticket.id, { status });
      setTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success("Ticket updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ticket could not be updated."));
    }
  };

  const handleTicketPriority = async (
    ticket: SupportTicket,
    priority: string
  ) => {
    try {
      const updated = await updateAdminTicket(ticket.id, { priority });
      setTickets((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success("Ticket priority updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ticket could not be updated."));
    }
  };

  const handleAdminComment = async (ticket: SupportTicket) => {
    const body = commentDrafts[ticket.id]?.trim();
    if (!body) return;

    try {
      await createSupportTicketComment(ticket.id, body);
      setCommentDrafts((current) => ({ ...current, [ticket.id]: "" }));
      const refreshedTickets = await getAdminTickets();
      setTickets(refreshedTickets);
      toast.success("Comment added.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Comment could not be added."));
    }
  };

  const handleDeleteTicket = async (ticket: SupportTicket) => {
    setDeletingSupportTicket(true);
    try {
      await deleteSupportTicket(ticket.id);
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
      setSelectedTicketId((current) => (current === ticket.id ? null : current));
      setSupportTicketToDelete(null);
      toast.success("Ticket deleted.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ticket could not be deleted."));
    } finally {
      setDeletingSupportTicket(false);
    }
  };

  const handleDeleteTicketComment = async (
    ticket: SupportTicket,
    commentId: number
  ) => {
    setDeletingSupportComment(true);
    try {
      await deleteSupportTicketComment(ticket.id, commentId);
      const refreshedTickets = await getAdminTickets();
      setTickets(refreshedTickets);
      setSupportCommentToDelete(null);
      toast.success("Comment deleted.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Comment could not be deleted."));
    } finally {
      setDeletingSupportComment(false);
    }
  };

  const handleUserUpdate = async (
    user: AdminUser,
    data: { is_active?: boolean; is_global_admin?: boolean }
  ) => {
    try {
      const updated = await updateAdminUser(user.id, data);
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success("User updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "User could not be updated."));
    }
  };

  const handleExport = async (kind: "projects" | "users" | "ai-usage") => {
    try {
      await downloadAdminCsv(kind);
      toast.success("CSV export started.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "CSV export failed."));
    }
  };

  const handlePlatformPdfExport = async () => {
    try {
      await downloadAdminPlatformPdf();
      toast.success("Platform PDF export started.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "PDF export failed."));
    }
  };

  const handleProjectArchive = async (project: AdminProject) => {
    setProjectActionId(project.id);
    try {
      const updated = await updateAdminProjectArchive(
        project.id,
        !project.is_archived
      );
      setProjects((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      toast.success(updated.is_archived ? "Project archived." : "Project restored.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Project status could not be updated."));
    } finally {
      setProjectActionId(null);
    }
  };

  const handleProjectDelete = async () => {
    if (!projectToDelete) return;

    setProjectActionId(projectToDelete.id);
    try {
      await deleteAdminProject(projectToDelete.id, deleteConfirmation);
      setProjects((current) =>
        current.filter((project) => project.id !== projectToDelete.id)
      );
      setProjectToDelete(null);
      setDeleteConfirmation("");
      toast.success("Project deleted.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Project could not be deleted."));
    } finally {
      setProjectActionId(null);
    }
  };

  if (
    loading &&
    !overview &&
    users.length === 0 &&
    projects.length === 0 &&
    tickets.length === 0 &&
    errors.length === 0 &&
    aiUsage.length === 0
  ) {
    return <AdminConsoleSkeleton />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1560px] space-y-6 p-4 text-slate-100 sm:p-5 xl:p-7">
      <section
        id="command"
        className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/75 shadow-2xl shadow-slate-950/30"
      >
        <div className="flex flex-col gap-5 border-b border-slate-800 bg-slate-900/35 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-blue-300">
                Platform Operations
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Global Admin Console
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Control surface pentru utilizatori, proiecte, suport, AI usage si
                sanatatea aplicatiei.
              </p>
            </div>
          </div>

          <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[560px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search console..."
                className="h-12 w-full rounded-2xl border-slate-800 bg-slate-950/80 pl-10 text-slate-100 placeholder:text-slate-600"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                onClick={handlePlatformPdfExport}
                variant="outline"
                className="h-11 rounded-xl border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
              >
                <Download className="mr-2 h-4 w-4" />
                PDF Report
              </Button>
              <Button
                onClick={loadAdminData}
                disabled={loading}
                className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Gauge className="h-4 w-4 text-emerald-300" />
              Active projects
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">{activeProjects}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Archive className="h-4 w-4 text-amber-300" />
              Archived
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">{archivedProjects}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <LifeBuoy className="h-4 w-4 text-blue-300" />
              Active support
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">{openOrActiveTickets}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ServerCrash className="h-4 w-4 text-red-300" />
              Server errors
            </div>
            <p className="mt-2 text-2xl font-semibold text-white">{serverErrors}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto border-t border-slate-800 px-4 py-3">
          {[
            ["Identity", "#users"],
            ["Projects", "#projects"],
            ["Support", "#support"],
            ["AI Usage", "#ai-usage"],
            ["Health", "#errors"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="shrink-0 rounded-full border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white"
            >
              {label}
            </a>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Users}
          label="Users"
          value={overview?.users ?? "-"}
          detail={`${activeUsers} active, ${globalAdmins} admins`}
          tone="blue"
        />
        <MetricCard
          icon={FolderKanban}
          label="Projects"
          value={overview?.projects ?? "-"}
          detail={`${activeProjects} active, ${overview?.tasks ?? 0} tasks`}
          tone="emerald"
        />
        <MetricCard
          icon={Ticket}
          label="Open Tickets"
          value={overview?.open_tickets ?? "-"}
          detail="Support queue"
          tone="amber"
        />
        <MetricCard
          icon={ServerCrash}
          label="Errors 24h"
          value={overview?.errors_last_24h ?? "-"}
          detail="HTTP 4xx and 5xx"
          tone="red"
        />
        <MetricCard
          icon={Bot}
          label="AI"
          value={overview?.ai_configured ? "On" : "Off"}
          detail={`${overview?.ai_requests ?? 0} total · ${overview?.ai_requests_24h ?? 0} in 24h`}
          tone="violet"
        />
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Operations Pulse
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Semnale rapide pentru demo, suport si stabilitate.
              </p>
            </div>
            <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
              Live data
            </Badge>
          </div>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Triage pressure
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {criticalTickets}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                critical tickets total
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                AI requests
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {overview?.ai_requests_24h ?? 0}
              </p>
              <p className="mt-1 text-sm text-slate-500">in the last 24h</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                Error signal
              </p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {overview?.errors_last_24h ?? 0}
              </p>
              <p className="mt-1 text-sm text-slate-500">HTTP events today</p>
            </div>
          </div>
        </div>

        <div className="min-w-0 rounded-3xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Incident Focus
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Open support items that need attention.
              </p>
            </div>
            <button
              type="button"
              onClick={() => focusSupportTicket()}
              className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-blue-500/40 hover:text-white"
            >
              Open desk
            </button>
          </div>
          <div className="space-y-2">
            {topIncidents.length > 0 ? (
              topIncidents.map((ticket) => {
                const selected = selectedTicketId === ticket.id;

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => focusSupportTicket(ticket.id)}
                    className={
                      selected
                        ? "flex w-full items-center justify-between gap-3 rounded-2xl border border-blue-500/45 bg-blue-500/10 p-3 text-left shadow-lg shadow-blue-950/10"
                        : "flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/45 p-3 text-left transition hover:border-blue-500/35 hover:bg-blue-500/10"
                    }
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-white">
                        #{ticket.id} {ticket.title}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {ticket.priority} · {ticket.status.replace("_", " ")}
                      </span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                No active support pressure right now.
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="users"
        className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-2 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Users</h2>
            <p className="mt-1 text-sm text-slate-500">
              Administrare conturi, status si acces Global Admin.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="w-fit border-blue-500/30 bg-blue-500/10 text-blue-200">
              {filteredUsers.length} shown
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("users")}
              className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Download className="mr-2 h-4 w-4 text-emerald-300" />
              CSV
            </Button>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              className="grid gap-4 p-5 xl:grid-cols-[1.2fr_1fr_auto]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <UserAvatar
                  name={user.full_name || "User"}
                  email={user.email}
                  src={resolveMediaUrl(user.avatar_url)}
                  className="h-12 w-12 shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold text-white">
                      {user.full_name || "Unnamed user"}
                    </h3>
                    {user.is_global_admin && (
                      <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                        Global Admin
                      </Badge>
                    )}
                    <Badge
                      className={
                        user.is_active
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                          : "border-red-500/30 bg-red-500/10 text-red-200"
                      }
                    >
                      {user.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {user.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <p className="text-xl font-semibold text-white">
                    {user.projects_count}
                  </p>
                  <p className="text-xs text-slate-500">projects</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <p className="text-xl font-semibold text-white">
                    {user.owned_projects_count}
                  </p>
                  <p className="text-xs text-slate-500">owned</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2">
                  <p className="text-xl font-semibold text-white">
                    {user.assigned_tasks_count}
                  </p>
                  <p className="text-xs text-slate-500">tasks</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap xl:justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={user.id === currentUser?.id}
                  className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() =>
                    handleUserUpdate(user, { is_active: !user.is_active })
                  }
                >
                  {user.is_active ? "Deactivate" : "Activate"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={user.id === currentUser?.id}
                  className="rounded-lg border-blue-500/30 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 hover:text-white"
                  onClick={() =>
                    handleUserUpdate(user, {
                      is_global_admin: !user.is_global_admin,
                    })
                  }
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  {user.is_global_admin ? "Remove admin" : "Make admin"}
                </Button>
              </div>
            </div>
          ))}

          {!loading && filteredUsers.length === 0 && (
            <div className="p-8 text-sm text-slate-500">No users found.</div>
          )}
        </div>
      </section>

      <section
        id="projects"
        className="rounded-xl border border-slate-800 bg-slate-950/80 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Project Registry</h2>
            <p className="mt-1 text-sm text-slate-500">
              Workspaces, methodology state and destructive admin actions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {["ACTIVE", "ARCHIVED", "ALL"].map((status) => (
              <Button
                key={status}
                size="sm"
                variant="outline"
                onClick={() => setProjectStatusFilter(status)}
                className={
                  projectStatusFilter === status
                    ? "rounded-lg border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
                    : "rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              >
                {status}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("projects")}
              className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Download className="mr-2 h-4 w-4 text-blue-300" />
              CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[980px] grid-cols-[1.4fr_150px_150px_150px_220px] border-b border-slate-800 px-5 py-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-600">
            <span>Workspace</span>
            <span>Method</span>
            <span>Load</span>
            <span>Created</span>
            <span className="text-right">Actions</span>
          </div>
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="grid min-w-[980px] grid-cols-[1.4fr_150px_150px_150px_220px] items-center gap-4 border-b border-slate-800 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-white">
                    {project.name}
                  </h3>
                  <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                    {project.key}
                  </Badge>
                  {project.is_archived && (
                    <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                      Archived
                    </Badge>
                  )}
                </div>
                <p className="mt-2 truncate text-sm text-slate-500">
                  Admin: {project.owner_name || "Unassigned"} ·{" "}
                  {project.owner_email || "No email"}
                </p>
              </div>

              <Badge className="w-fit border-slate-700 bg-slate-900 text-slate-300">
                {project.methodology}
              </Badge>

              <div className="text-sm text-slate-300">
                <p className="font-semibold text-white">
                  {project.tasks_count} tasks
                </p>
                <p className="text-xs text-slate-500">
                  {project.members_count} members
                </p>
              </div>

              <p className="text-sm text-slate-500">
                {formatDate(project.created_at)}
              </p>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={projectActionId === project.id}
                  className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => handleProjectArchive(project)}
                >
                  {project.is_archived ? (
                    <ArchiveRestore className="mr-2 h-4 w-4" />
                  ) : (
                    <Archive className="mr-2 h-4 w-4" />
                  )}
                  {project.is_archived ? "Restore" : "Archive"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={projectActionId === project.id}
                  className="rounded-lg border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                  onClick={() => {
                    setProjectToDelete(project);
                    setDeleteConfirmation("");
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))}

          {!loading && filteredProjects.length === 0 && (
            <div className="p-8 text-sm text-slate-500">No projects found.</div>
          )}
        </div>
      </section>

      <section
        id="support"
        className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-900/30 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-amber-300" />
              <h2 className="text-xl font-semibold text-white">
                Support Desk
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Triaza tichetele, raspunde utilizatorilor si urmareste
              conversatia completa fara sa schimbi pagina.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(
              (status) => (
                <Button
                  key={status}
                  size="sm"
                  variant="outline"
                  onClick={() => setTicketFilter(status)}
                  className={
                    ticketFilter === status
                      ? "rounded-lg border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
                      : "rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                  }
                >
                  {status.replace("_", " ")}
                </Button>
              )
            )}
          </div>
        </div>

        <div className="grid min-w-0 gap-0 overflow-hidden xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="min-w-0 border-b border-slate-800 xl:border-b-0 xl:border-r">
            <div className="grid min-w-0 grid-cols-2 gap-2 border-b border-slate-800 p-4 sm:grid-cols-4 xl:grid-cols-2">
              {ticketStatuses.map((status) => (
                <div
                  key={status}
                  className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-600">
                    {status.replace("_", " ")}
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {ticketStatusCounts[status] || 0}
                  </p>
                </div>
              ))}
            </div>

            <div className="max-h-[720px] min-w-0 space-y-2 overflow-y-auto p-3">
              {filteredTickets.map((ticket) => {
                const selected = selectedTicket?.id === ticket.id;
                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelectedTicketId(ticket.id)}
                    className={
                      selected
                        ? "w-full rounded-2xl border border-blue-500/45 bg-blue-500/10 p-4 text-left shadow-lg shadow-blue-950/20"
                        : "w-full rounded-2xl border border-slate-800 bg-slate-900/45 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900/70"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-sm font-semibold text-white">
                          #{ticket.id} {ticket.title}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {ticket.reporter_name ||
                            ticket.reporter_email ||
                            "User"}{" "}
                          · {formatDate(ticket.created_at)}
                        </p>
                      </div>
                      <Badge
                        className={
                          statusStyles[ticket.status] ||
                          "border-slate-700 bg-slate-900 text-slate-300"
                        }
                      >
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                        {ticket.priority}
                      </Badge>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-300" />
                        {ticket.comments_count || ticket.comments?.length || 0}
                      </span>
                    </div>
                  </button>
                );
              })}

              {!loading && filteredTickets.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                  No support tickets match this filter.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0">
            {selectedTicket ? (
              <div className="grid min-h-[720px] gap-0 xl:grid-cols-[minmax(0,1fr)_310px]">
                <div className="min-w-0">
                  <div className="border-b border-slate-800 p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                        Ticket #{selectedTicket.id}
                      </Badge>
                      <Badge
                        className={
                          statusStyles[selectedTicket.status] ||
                          "border-slate-700 bg-slate-900 text-slate-300"
                        }
                      >
                        {selectedTicket.status.replace("_", " ")}
                      </Badge>
                      <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                        {selectedTicket.priority}
                      </Badge>
                    </div>
                    <h3 className="break-words text-2xl font-semibold tracking-tight text-white">
                      {selectedTicket.title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500">
                      Reported by{" "}
                      {selectedTicket.reporter_name ||
                        selectedTicket.reporter_email ||
                        "User"}{" "}
                      · {formatDate(selectedTicket.created_at)}
                    </p>
                  </div>

                  <div className="space-y-5 p-5">
                    {selectedTicket.description && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                          Original report
                        </p>
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                          {selectedTicket.description}
                        </p>
                      </div>
                    )}

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-blue-300" />
                          <h4 className="text-sm font-semibold text-white">
                            Conversation
                          </h4>
                        </div>
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          {(selectedTicket.comments || []).length} messages
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        {(selectedTicket.comments || []).map((comment) => (
                          <div
                            key={comment.id}
                            className={
                              comment.is_admin_note
                                ? "rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4"
                                : "rounded-2xl border border-slate-800 bg-slate-900/45 p-4"
                            }
                          >
                            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">
                                  {comment.author_name ||
                                    comment.author_email ||
                                    "User"}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {comment.is_admin_note
                                    ? "Admin reply"
                                    : "User comment"}{" "}
                                  · {formatDate(comment.created_at)}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-red-200 transition hover:bg-red-500/20"
                                onClick={() =>
                                  setSupportCommentToDelete({
                                    ticket: selectedTicket,
                                    commentId: comment.id,
                                  })
                                }
                                title="Delete comment"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                              {comment.body}
                            </p>
                          </div>
                        ))}

                        {(selectedTicket.comments || []).length === 0 && (
                          <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                            No comments yet. Reply below to start the thread.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                      <Textarea
                        value={commentDrafts[selectedTicket.id] || ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [selectedTicket.id]: event.target.value,
                          }))
                        }
                        placeholder="Write an admin reply..."
                        className="min-h-28 rounded-xl border-slate-800 bg-slate-950 text-sm text-slate-100 placeholder:text-slate-600"
                      />
                      <div className="mt-3 flex justify-end">
                        <Button
                          className="h-10 w-full rounded-xl bg-blue-600 text-white hover:bg-blue-500 sm:w-auto"
                          disabled={!commentDrafts[selectedTicket.id]?.trim()}
                          onClick={() => handleAdminComment(selectedTicket)}
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <aside className="border-t border-slate-800 bg-slate-950/55 p-5 xl:border-l xl:border-t-0">
                  <div className="sticky top-5 space-y-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Status
                      </p>
                      <div className="mt-3 grid gap-2">
                        {ticketStatuses.map((status) => {
                          const active = selectedTicket.status === status;
                          return (
                            <Button
                              key={status}
                              size="sm"
                              variant="outline"
                              className={
                                active
                                  ? "h-10 justify-start rounded-xl border-blue-500/40 bg-blue-500/15 text-blue-100"
                                  : "h-10 justify-start rounded-xl border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                              }
                              onClick={() =>
                                handleTicketStatus(selectedTicket, status)
                              }
                              disabled={active}
                            >
                              {active ? (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                              ) : (
                                <Clock3 className="mr-2 h-4 w-4" />
                              )}
                              {status.replace("_", " ")}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Priority
                      </p>
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                        {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
                          (priority) => (
                            <Button
                              key={priority}
                              size="sm"
                              variant="outline"
                              className={
                                selectedTicket.priority === priority
                                  ? "h-9 rounded-xl border-amber-500/40 bg-amber-500/15 text-amber-100"
                                  : "h-9 rounded-xl border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                              }
                              onClick={() =>
                                handleTicketPriority(selectedTicket, priority)
                              }
                            >
                              {priority}
                            </Button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
                        Timeline
                      </p>
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="text-slate-500">Created</p>
                          <p className="mt-1 text-slate-200">
                            {formatDate(selectedTicket.created_at)}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Updated</p>
                          <p className="mt-1 text-slate-200">
                            {formatDate(selectedTicket.updated_at)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 w-full rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                      onClick={() => setSupportTicketToDelete(selectedTicket)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ticket
                    </Button>
                  </div>
                </aside>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center p-8 text-center">
                <div>
                  <LifeBuoy className="mx-auto h-10 w-10 text-slate-600" />
                  <h3 className="mt-4 text-lg font-semibold text-white">
                    No ticket selected
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Pick a support ticket from the queue to inspect the full
                    conversation and admin actions.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section
        id="ai-usage"
        className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-3 border-b border-slate-800 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Usage</h2>
            <p className="mt-1 text-sm text-slate-500">
              Cereri AI contorizate pentru audit si raportare licenta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="w-fit border-violet-500/30 bg-violet-500/10 text-violet-200">
              {filteredAiUsage.length} events
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("ai-usage")}
              className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <Download className="mr-2 h-4 w-4 text-violet-300" />
              CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-800 p-5 lg:grid-cols-[1fr_160px_180px_160px_auto]">
          <div className="min-w-0">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Feature
            </label>
            <select
              value={aiFeatureFilter}
              onChange={(event) => setAiFeatureFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All features</option>
              {aiFeatureOptions.map((feature) => (
                <option key={feature} value={feature}>
                  {feature.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Status
            </label>
            <select
              value={aiStatusFilter}
              onChange={(event) => setAiStatusFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="ERROR">Error</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Project
            </label>
            <select
              value={aiProjectFilter}
              onChange={(event) => setAiProjectFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All projects</option>
              <option value="NONE">No project</option>
              {aiProjectOptions.map(([projectId, projectName]) => (
                <option key={projectId} value={String(projectId)}>
                  {projectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
              Period
            </label>
            <select
              value={aiTimeFilter}
              onChange={(event) => setAiTimeFilter(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 text-sm text-slate-200 outline-none transition focus:border-blue-500"
            >
              <option value="ALL">All time</option>
              <option value="1">Last 24h</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="h-10 w-full rounded-xl border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white lg:w-auto"
              onClick={resetAiFilters}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4 text-violet-300" />
              Reset
            </Button>
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredAiUsage.slice(0, 20).map((item) => (
            <div
              key={item.id}
              className="grid gap-3 p-4 text-sm lg:grid-cols-[220px_1fr_160px_190px]"
            >
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-300" />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {item.feature.replace("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.provider} · {item.source || "unknown"}
                  </p>
                </div>
              </div>
              <p className="truncate text-slate-400">
                {item.project_name || "No project"} · {item.user_name || "Unknown user"}
              </p>
              <Badge
                className={
                  item.status === "ERROR"
                    ? "w-fit border-red-500/30 bg-red-500/10 text-red-200"
                    : "w-fit border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                }
              >
                {item.status}
              </Badge>
              <p className="text-slate-500 lg:text-right">
                {formatDate(item.created_at)}
              </p>
            </div>
          ))}

          {!loading && filteredAiUsage.length === 0 && (
            <div className="p-8 text-sm text-slate-500">
              No AI usage has been recorded yet.
            </div>
          )}
        </div>
      </section>

      <section
        id="errors"
        className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Application Errors
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ultimele raspunsuri HTTP 4xx si 5xx capturate automat.
            </p>
          </div>

          <div className="flex gap-2">
            {["ALL", "5XX", "4XX"].map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant="outline"
                onClick={() => setErrorFilter(filter)}
                className={
                  errorFilter === filter
                    ? "rounded-lg border-blue-500 bg-blue-600 text-white hover:bg-blue-500"
                    : "rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                }
              >
                {filter}
              </Button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredErrors.slice(0, 30).map((error) => (
            <div
              key={error.id}
              className="grid gap-3 p-4 text-sm md:grid-cols-[120px_minmax(0,1fr)_170px_170px_120px]"
            >
              <div className="flex items-center gap-2">
                <Badge
                  className={
                    error.status_code >= 500
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  }
                >
                  {error.status_code}
                </Badge>
                <span className="font-medium text-slate-300">
                  {error.method}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-mono text-slate-300">
                  {error.path}
                </p>
                {error.detail && (
                  <p className="mt-1 truncate text-xs text-slate-600">
                    Extended context captured
                  </p>
                )}
              </div>
              <p className="truncate text-slate-500">
                {error.user_name || "Anonymous"}
              </p>
              <p className="text-slate-500 md:text-right">
                {formatDate(error.created_at)}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-9 w-full rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white md:w-auto"
                onClick={() => setSelectedError(error)}
              >
                <Eye className="mr-2 h-4 w-4" />
                Inspect
              </Button>
            </div>
          ))}

          {!loading && filteredErrors.length === 0 && (
            <div className="flex items-center gap-3 p-8 text-sm text-slate-500">
              <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              No captured errors for this filter.
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(selectedError)}
        onOpenChange={(open) => {
          if (!open) setSelectedError(null);
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100 sm:max-w-2xl">
          {selectedError && (
            <>
              <DialogHeader>
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-200">
                  <ServerCrash className="h-6 w-6" />
                </div>
                <DialogTitle className="text-white">
                  HTTP {selectedError.status_code} inspection
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                  Captured platform context for this request. Sensitive header
                  values and query values are not stored.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Request
                  </p>
                  <p className="mt-2 break-words font-mono text-sm text-white">
                    {selectedError.method} {selectedError.path}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Actor
                  </p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {selectedError.user_name || "Anonymous request"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(selectedError.created_at)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Extended context
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Metadata saved by the backend error middleware.
                    </p>
                  </div>
                  <Badge
                    className={
                      selectedError.status_code >= 500
                        ? "border-red-500/30 bg-red-500/10 text-red-200"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                    }
                  >
                    {selectedError.status_code >= 500 ? "Server" : "Client"} error
                  </Badge>
                </div>

                {Object.keys(selectedErrorDetails).length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(selectedErrorDetails).map(([key, value]) => (
                      <div
                        key={key}
                        className="min-w-0 rounded-lg border border-slate-800 bg-slate-950/70 p-3"
                      >
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          {key.replaceAll("_", " ")}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                          {formatErrorDetailValue(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-500">
                    This older error was captured before extended context was
                    enabled.
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={() => {
                    navigator.clipboard?.writeText(
                      `${selectedError.method} ${selectedError.path} -> ${selectedError.status_code}`
                    );
                    toast.success("Error summary copied.");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy summary
                </Button>
                <Button
                  className="rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => setSelectedError(null)}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={supportCommentToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSupportCommentToDelete(null);
        }}
        title="Delete support comment?"
        description="This removes the selected message from the ticket conversation."
        confirmLabel="Delete comment"
        destructive
        loading={deletingSupportComment}
        onConfirm={() => {
          if (supportCommentToDelete) {
            handleDeleteTicketComment(
              supportCommentToDelete.ticket,
              supportCommentToDelete.commentId
            );
          }
        }}
      />

      <ConfirmDialog
        open={supportTicketToDelete !== null}
        onOpenChange={(open) => {
          if (!open) setSupportTicketToDelete(null);
        }}
        title="Delete support ticket?"
        description="This removes the selected support ticket and its full conversation."
        confirmLabel="Delete ticket"
        destructive
        loading={deletingSupportTicket}
        onConfirm={() => {
          if (supportTicketToDelete) {
            handleDeleteTicket(supportTicketToDelete);
          }
        }}
      />

      <Dialog
        open={Boolean(projectToDelete)}
        onOpenChange={(open) => {
          if (!open) {
            setProjectToDelete(null);
            setDeleteConfirmation("");
          }
        }}
      >
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100 sm:max-w-xl">
          <DialogHeader>
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-200">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-white">Delete project permanently</DialogTitle>
            <DialogDescription className="text-slate-400">
              This removes the workspace, tasks, sprints, teams, calendar events,
              documentation and GitHub history linked to this project. AI usage
              rows are kept for audit, but detached from the deleted project.
            </DialogDescription>
          </DialogHeader>

          {projectToDelete && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">
                    {projectToDelete.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Type <span className="font-semibold text-red-200">{projectToDelete.key}</span> to confirm.
                  </p>
                </div>
                <Badge className="border-red-500/30 bg-red-500/10 text-red-200">
                  {projectToDelete.key}
                </Badge>
              </div>

              <Input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={projectToDelete.key}
                className="mt-4 h-11 rounded-xl border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => {
                setProjectToDelete(null);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-600 text-white hover:bg-red-500"
              disabled={
                !projectToDelete ||
                deleteConfirmation.trim().toUpperCase() !== projectToDelete.key ||
                projectActionId === projectToDelete?.id
              }
              onClick={handleProjectDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
