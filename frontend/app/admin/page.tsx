"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FolderKanban,
  MessageSquare,
  RefreshCw,
  Search,
  ServerCrash,
  ShieldCheck,
  Send,
  Ticket,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  AdminOverview,
  AdminProject,
  AdminUser,
  createSupportTicketComment,
  getAdminErrors,
  getAdminOverview,
  getAdminProjects,
  getAdminTickets,
  getAdminUsers,
  HttpErrorLog,
  SupportTicket,
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

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 shadow-xl shadow-slate-950/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-semibold text-white">{value}</p>
      </div>
      <div className="mt-4">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-500">{detail}</p>
      </div>
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
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [ticketFilter, setTicketFilter] = useState("ALL");
  const [errorFilter, setErrorFilter] = useState("ALL");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        overviewData,
        projectData,
        userData,
        ticketData,
        errorData,
      ] = await Promise.all([
        getAdminOverview(),
        getAdminProjects(),
        getAdminUsers(),
        getAdminTickets(),
        getAdminErrors(),
      ]);

      setOverview(overviewData);
      setProjects(projectData);
      setUsers(userData);
      setTickets(ticketData);
      setErrors(errorData);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Admin data could not be loaded."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const normalizedQuery = query.trim().toLowerCase();
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
        if (!normalizedQuery) return true;
        return `${project.name} ${project.key} ${project.owner_name || ""} ${project.owner_email || ""}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [normalizedQuery, projects]
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
          `${error.method} ${error.path} ${error.status_code}`
            .toLowerCase()
            .includes(normalizedQuery);
        return severityMatches && queryMatches;
      }),
    [errorFilter, errors, normalizedQuery]
  );

  const globalAdmins = users.filter((user) => user.is_global_admin).length;
  const activeUsers = users.filter((user) => user.is_active).length;
  const ticketColumns = useMemo(
    () =>
      ticketStatuses.map((status) => ({
        status,
        tickets: filteredTickets.filter((ticket) => ticket.status === status),
      })),
    [filteredTickets]
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 text-slate-100 lg:p-8">
      <section className="flex flex-col gap-4 border-b border-slate-800 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">
                Platform Console
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Global Admin
              </h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-slate-400">
            Consola separata pentru administrarea platformei: utilizatori,
            proiecte, tichete de suport si erori aplicatie.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search console..."
              className="h-11 w-full rounded-xl border-slate-800 bg-slate-950 pl-10 text-slate-100 placeholder:text-slate-600 sm:w-72"
            />
          </div>
          <Button
            onClick={loadAdminData}
            disabled={loading}
            className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard
          icon={Users}
          label="Users"
          value={overview?.users ?? "-"}
          detail={`${activeUsers} active, ${globalAdmins} admins`}
        />
        <MetricCard
          icon={FolderKanban}
          label="Projects"
          value={overview?.projects ?? "-"}
          detail={`${overview?.tasks ?? 0} tasks total`}
        />
        <MetricCard
          icon={Ticket}
          label="Open Tickets"
          value={overview?.open_tickets ?? "-"}
          detail="Support queue"
        />
        <MetricCard
          icon={ServerCrash}
          label="Errors 24h"
          value={overview?.errors_last_24h ?? "-"}
          detail="HTTP 4xx and 5xx"
        />
        <MetricCard
          icon={Bot}
          label="AI"
          value={overview?.ai_configured ? "On" : "Off"}
          detail={`${overview?.ai_requests ?? 0} tracked requests`}
        />
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
          <Badge className="w-fit border-blue-500/30 bg-blue-500/10 text-blue-200">
            {filteredUsers.length} shown
          </Badge>
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

              <div className="grid grid-cols-3 gap-3 text-sm">
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

              <div className="flex flex-wrap gap-2 xl:justify-end">
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
        className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="border-b border-slate-800 p-5">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <p className="mt-1 text-sm text-slate-500">
            Workspace-uri create in platforma si incarcarea lor curenta.
          </p>
        </div>

        <div className="divide-y divide-slate-800">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="grid gap-4 p-5 lg:grid-cols-[1fr_auto_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-white">
                    {project.name}
                  </h3>
                  <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                    {project.key}
                  </Badge>
                  <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                    {project.methodology}
                  </Badge>
                </div>
                <p className="mt-2 truncate text-sm text-slate-500">
                  Admin: {project.owner_name || "Unassigned"} ·{" "}
                  {project.owner_email || "No email"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-2xl font-semibold text-white">
                    {project.members_count}
                  </p>
                  <p className="text-slate-500">members</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
                  <p className="text-2xl font-semibold text-white">
                    {project.tasks_count}
                  </p>
                  <p className="text-slate-500">tasks</p>
                </div>
              </div>

              <p className="text-sm text-slate-500 lg:text-right">
                {formatDate(project.created_at)}
              </p>
            </div>
          ))}

          {!loading && filteredProjects.length === 0 && (
            <div className="p-8 text-sm text-slate-500">No projects found.</div>
          )}
        </div>
      </section>

      <section
        id="support"
        className="rounded-2xl border border-slate-800 bg-slate-950/70 shadow-xl shadow-slate-950/20"
      >
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Support Tickets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Prioritizeaza si inchide cererile de suport.
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

        <div className="grid gap-4 p-5 xl:grid-cols-4">
          {ticketColumns.map((column) => (
            <div
              key={column.status}
              className="min-h-[360px] rounded-2xl border border-slate-800 bg-slate-950/80 p-3"
            >
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {column.status.replace("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    {column.tickets.length} tickets
                  </p>
                </div>
                <Badge
                  className={
                    statusStyles[column.status] ||
                    "border-slate-700 bg-slate-900 text-slate-300"
                  }
                >
                  {column.tickets.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {column.tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/15"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-sm font-semibold text-white">
                          {ticket.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          #{ticket.id} ·{" "}
                          {ticket.reporter_name ||
                            ticket.reporter_email ||
                            "User"}
                        </p>
                      </div>
                      <Badge className="shrink-0 border-amber-500/30 bg-amber-500/10 text-amber-200">
                        {ticket.priority}
                      </Badge>
                    </div>

                    {ticket.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                        {ticket.description}
                      </p>
                    )}

                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                      <MessageSquare className="h-3.5 w-3.5 text-blue-300" />
                      {ticket.comments_count || ticket.comments?.length || 0}{" "}
                      comments · {formatDate(ticket.created_at)}
                    </div>

                    {(ticket.comments || []).slice(-2).map((comment) => (
                      <div
                        key={comment.id}
                        className={
                          comment.is_admin_note
                            ? "mt-3 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3"
                            : "mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3"
                        }
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-semibold text-white">
                            {comment.author_name ||
                              comment.author_email ||
                              "User"}
                          </p>
                          <p className="shrink-0 text-[11px] text-slate-600">
                            {formatDate(comment.created_at)}
                          </p>
                        </div>
                        <p className="line-clamp-3 text-xs leading-5 text-slate-300">
                          {comment.body}
                        </p>
                      </div>
                    ))}

                    <div className="mt-4 space-y-2">
                      <Textarea
                        value={commentDrafts[ticket.id] || ""}
                        onChange={(event) =>
                          setCommentDrafts((current) => ({
                            ...current,
                            [ticket.id]: event.target.value,
                          }))
                        }
                        placeholder="Reply to user..."
                        className="min-h-20 rounded-xl border-slate-800 bg-slate-950 text-xs text-slate-100 placeholder:text-slate-600"
                      />
                      <Button
                        size="sm"
                        className="h-8 rounded-lg bg-blue-600 text-white hover:bg-blue-500"
                        disabled={!commentDrafts[ticket.id]?.trim()}
                        onClick={() => handleAdminComment(ticket)}
                      >
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Reply
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map(
                        (priority) => (
                          <Button
                            key={priority}
                            size="sm"
                            variant="outline"
                            className={
                              ticket.priority === priority
                                ? "h-8 rounded-lg border-amber-500/40 bg-amber-500/15 text-amber-100"
                                : "h-8 rounded-lg border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                            }
                            onClick={() => handleTicketPriority(ticket, priority)}
                          >
                            {priority}
                          </Button>
                        )
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {ticketStatuses.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-lg border-slate-700 bg-slate-950 text-xs text-slate-300 hover:bg-slate-800 hover:text-white"
                          onClick={() => handleTicketStatus(ticket, status)}
                          disabled={ticket.status === status}
                        >
                          {status.replace("_", " ")}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}

                {!loading && column.tickets.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 p-5 text-center text-sm text-slate-600">
                    No tickets
                  </div>
                )}
              </div>
            </div>
          ))}
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
              className="grid gap-3 p-4 text-sm md:grid-cols-[120px_1fr_180px_180px]"
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
              <p className="truncate font-mono text-slate-300">
                {error.path}
              </p>
              <p className="truncate text-slate-500">
                {error.user_name || "Anonymous"}
              </p>
              <p className="text-slate-500 md:text-right">
                {formatDate(error.created_at)}
              </p>
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
    </div>
  );
}
