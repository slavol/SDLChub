"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Filter,
  GitBranch,
  History,
  MessageSquareText,
  RefreshCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AuditChangeSummary, formatAuditFieldLabel } from "@/components/dashboard/audit-log-event";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMyProjects,
  getProjectMembers,
  Project,
  ProjectMember,
} from "@/services/project";
import { getProjectActivity, ProjectActivity } from "@/services/activity";
import { pickWorkspaceProject } from "@/lib/project-selection";
import { useProjectStore } from "@/store/use-project-store";
import { UserAvatar } from "@/components/user-avatar";

type TimeFilter = "all" | "24" | "72" | "168" | "720";
type ActionFilter = "all" | string;
type ActorFilter = "all" | string;
type FieldFilter = "all" | string;
type SortFilter = "newest" | "oldest";
type ScopeFilter = "all" | "tasks" | "comments" | "subtasks" | "status";

const actionLabels: Record<string, string> = {
  TASK_CREATED: "Created task",
  TASK_UPDATED: "Updated task",
  SUBTASK_CREATED: "Added subtask",
  SUBTASK_UPDATED: "Updated subtask",
  COMMENT_ADDED: "Commented",
  COMMENT_UPDATED: "Edited comment",
  COMMENT_DELETED: "Deleted comment",
};

const actionStyles: Record<string, string> = {
  TASK_CREATED: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  TASK_UPDATED: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  SUBTASK_CREATED: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  SUBTASK_UPDATED: "border-teal-500/20 bg-teal-500/10 text-teal-300",
  COMMENT_ADDED: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  COMMENT_UPDATED: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  COMMENT_DELETED: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

const INITIAL_VISIBLE_ACTIVITIES = 60;
const ACTIVITY_PAGE_SIZE = 60;
const ACTIVITY_FETCH_LIMIT = 1000;

const scopeOptions: Array<{
  value: ScopeFilter;
  label: string;
  description: string;
  icon: typeof Activity;
}> = [
  {
    value: "all",
    label: "All",
    description: "Every event",
    icon: Activity,
  },
  {
    value: "tasks",
    label: "Tasks",
    description: "Created and edited",
    icon: CheckCircle2,
  },
  {
    value: "comments",
    label: "Comments",
    description: "Team discussion",
    icon: MessageSquareText,
  },
  {
    value: "subtasks",
    label: "Subtasks",
    description: "Checklist work",
    icon: GitBranch,
  },
  {
    value: "status",
    label: "Status",
    description: "Flow changes",
    icon: Clock3,
  },
];

function formatRelativeTime(value: string) {
  if (!value) return "unknown time";

  const date = new Date(value);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (Number.isNaN(diffMinutes)) return "unknown time";
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatDateTime(value: string) {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionLabel(action: string) {
  return actionLabels[action] || action.replaceAll("_", " ").toLowerCase();
}

function getScope(item: ProjectActivity): ScopeFilter {
  if (item.action.startsWith("COMMENT")) return "comments";
  if (item.action.startsWith("SUBTASK")) return "subtasks";
  if (item.field === "status") return "status";
  if (item.action.startsWith("TASK")) return "tasks";

  return "all";
}

function includesSearch(item: ProjectActivity, searchTerm: string) {
  const query = searchTerm.trim().toLowerCase();

  if (!query) return true;

  return [
    item.task_key,
    item.task_title,
    item.actor_name,
    actionLabel(item.action),
    item.action,
    item.field,
    item.old_value,
    item.new_value,
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

function ActivityItem({
  item,
  isLast,
}: {
  item: ProjectActivity;
  isLast: boolean;
}) {
  const actor = item.actor_name || "System";

  return (
    <div className="relative grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-3 sm:grid-cols-[48px_minmax(0,1fr)] sm:gap-4">
      {!isLast && (
        <div className="absolute left-[19px] top-12 h-[calc(100%-16px)] w-px bg-slate-800 sm:left-[23px] sm:top-14 sm:h-[calc(100%-20px)]" />
      )}

      <UserAvatar
        name={actor}
        src={item.actor_avatar_url}
        className="relative z-10 h-10 w-10 rounded-2xl border-slate-800 shadow-lg shadow-slate-950/30 sm:h-12 sm:w-12"
        fallbackClassName="bg-slate-950 text-sm font-semibold text-slate-200"
      />

      <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-blue-500/35 hover:bg-slate-950">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  actionStyles[item.action] ||
                  "border-slate-700 bg-slate-900 text-slate-300"
                }
              >
                {actionLabel(item.action)}
              </Badge>
              {item.field && (
                <Badge
                  variant="outline"
                  className="max-w-full border-slate-700 bg-slate-900/80 text-slate-300"
                >
                  <span className="truncate">{formatAuditFieldLabel(item.field)}</span>
                </Badge>
              )}
              <span className="text-xs text-slate-500">
                {formatRelativeTime(item.created_at)}
              </span>
            </div>

            <p className="break-words text-sm text-slate-300">
              <span className="font-semibold text-white">{actor}</span>{" "}
              changed{" "}
              <Link
                href={`/dashboard/tasks/${item.task_id}`}
                className="font-semibold text-blue-300 hover:text-blue-200"
              >
                {item.task_key}
              </Link>
            </p>

            <Link
              href={`/dashboard/tasks/${item.task_id}`}
              className="mt-1 block truncate text-base font-semibold text-white hover:text-blue-200"
            >
              {item.task_title}
            </Link>

            <AuditChangeSummary event={item} />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
            <span className="whitespace-nowrap text-xs text-slate-500">
              {formatDateTime(item.created_at)}
            </span>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 text-slate-500 hover:bg-slate-900 hover:text-blue-300"
              asChild
            >
              <Link href={`/dashboard/tasks/${item.task_id}`}>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
                <Skeleton className="h-6 w-28 rounded-full" />
              </div>
              <Skeleton className="h-11 w-72 max-w-full" />
              <Skeleton className="h-5 w-[32rem] max-w-full" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-32 rounded-xl" />
              <Skeleton className="h-10 w-32 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-11 rounded-xl" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 rounded-2xl" />
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex min-w-0 gap-4">
                <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                <Skeleton className="h-28 min-w-0 flex-1 rounded-2xl" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function ActivityPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [activities, setActivities] = useState<ProjectActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [actorFilter, setActorFilter] = useState<ActorFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [fieldFilter, setFieldFilter] = useState<FieldFilter>("all");
  const [sortFilter, setSortFilter] = useState<SortFilter>("newest");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleActivityCount, setVisibleActivityCount] = useState(INITIAL_VISIBLE_ACTIVITIES);
  const deferredSearchTerm = useDeferredValue(searchTerm);

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);

      try {
        let selectedProject = currentProject;

        if (!selectedProject) {
          const projects = await getMyProjects();
          selectedProject = pickWorkspaceProject(projects, currentProject);

          if (selectedProject) {
            setCurrentProject(selectedProject);
          }
        }

        setProject(selectedProject);

        if (!selectedProject) {
          setMembers([]);
          setActivities([]);
          return;
        }

        const filters =
          timeFilter === "all"
            ? { limit: ACTIVITY_FETCH_LIMIT }
            : { limit: ACTIVITY_FETCH_LIMIT, hours: Number(timeFilter) };

        const [remoteMembers, remoteActivities] = await Promise.all([
          getProjectMembers(selectedProject.id).catch(() => []),
          getProjectActivity(selectedProject.id, filters).catch(() => []),
        ]);

        setMembers(remoteMembers);
        setActivities(remoteActivities);
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [currentProject, setCurrentProject, timeFilter]);

  const availableActions = useMemo(
    () => Array.from(new Set(activities.map((item) => item.action))).sort(),
    [activities]
  );

  const availableFields = useMemo(
    () =>
      Array.from(
        new Set(
          activities
            .map((item) => item.field)
            .filter((field): field is string => Boolean(field))
        )
      ).sort(),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    return activities
      .filter((item) => {
        if (scopeFilter !== "all" && getScope(item) !== scopeFilter) return false;
        if (actionFilter !== "all" && item.action !== actionFilter) return false;
        if (fieldFilter !== "all" && item.field !== fieldFilter) return false;

        if (
          actorFilter !== "all" &&
          String(item.actor_id || "system") !== actorFilter
        ) {
          return false;
        }

        return includesSearch(item, deferredSearchTerm);
      })
      .sort((first, second) => {
        const firstTime = new Date(first.created_at).getTime();
        const secondTime = new Date(second.created_at).getTime();

        return sortFilter === "newest"
          ? secondTime - firstTime
          : firstTime - secondTime;
      });
  }, [
    activities,
    actionFilter,
    actorFilter,
    deferredSearchTerm,
    fieldFilter,
    scopeFilter,
    sortFilter,
  ]);

  useEffect(() => {
    setVisibleActivityCount(INITIAL_VISIBLE_ACTIVITIES);
  }, [
    actionFilter,
    actorFilter,
    deferredSearchTerm,
    fieldFilter,
    scopeFilter,
    sortFilter,
    timeFilter,
  ]);

  const visibleActivities = useMemo(
    () => filteredActivities.slice(0, visibleActivityCount),
    [filteredActivities, visibleActivityCount]
  );

  const hasMoreActivities = visibleActivities.length < filteredActivities.length;

  const uniqueActors = useMemo(
    () =>
      new Set(
        filteredActivities
          .map((item) => item.actor_id || item.actor_name || "system")
          .filter(Boolean)
      ).size,
    [filteredActivities]
  );

  const commentEvents = filteredActivities.filter((item) =>
    item.action.startsWith("COMMENT")
  ).length;

  const taskEvents = filteredActivities.filter((item) =>
    item.action.startsWith("TASK")
  ).length;

  const activeFilterCount = [
    timeFilter !== "all",
    actorFilter !== "all",
    actionFilter !== "all",
    fieldFilter !== "all",
    scopeFilter !== "all",
    sortFilter !== "newest",
    searchTerm.trim().length > 0,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setTimeFilter("all");
    setActorFilter("all");
    setActionFilter("all");
    setFieldFilter("all");
    setSortFilter("newest");
    setScopeFilter("all");
    setSearchTerm("");
  };

  if (loading) {
    return <ActivityPageSkeleton />;
  }

  if (!project) {
    return (
      <div className="flex h-[80vh] items-center justify-center p-8 text-center">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8">
          <Activity className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h1 className="text-2xl font-semibold text-white">No project selected</h1>
          <p className="mt-2 text-slate-400">
            Select a project to view its audit trail.
          </p>
        </div>
      </div>
    );
  }

  return (
      <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">{project.key}</Badge>
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-950/70 text-slate-300"
                >
                  {project.methodology}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
                >
                  {activeFilterCount} active filters
                </Badge>
              </div>

              <h1 className="flex min-w-0 items-center gap-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                <History className="h-7 w-7 shrink-0 text-blue-400 sm:h-8 sm:w-8" />
                Activity Center
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Audit trail for task updates, comments, subtasks and workflow changes.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 sm:w-auto"
                asChild
              >
                <Link href="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto" asChild>
                <Link href="/dashboard/board">Open Board</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <Activity className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-2xl font-semibold text-white">
              {filteredActivities.length}
            </p>
            <p className="text-xs text-slate-500">events shown</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <UserRound className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-2xl font-semibold text-white">{uniqueActors}</p>
            <p className="text-xs text-slate-500">active actors</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <CalendarClock className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-2xl font-semibold text-white">{taskEvents}</p>
            <p className="text-xs text-slate-500">task updates</p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <MessageSquareText className="mb-3 h-5 w-5 text-cyan-300" />
            <p className="text-2xl font-semibold text-white">{commentEvents}</p>
            <p className="text-xs text-slate-500">comment events</p>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <Card className="h-fit min-w-0 overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:sticky xl:top-6 xl:mb-6 xl:max-h-[calc(100dvh-3rem)]">
          <CardHeader className="border-b border-slate-800/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-blue-400" />
                  Filters
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Search and slice the audit stream.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-950/70 text-slate-300"
                >
                  {activeFilterCount}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  disabled={activeFilterCount === 0}
                  className="h-8 border-slate-700 bg-slate-950/70 px-2.5 text-xs text-slate-300 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="sdlc-thin-scrollbar space-y-5 p-5 pb-6 xl:max-h-[calc(100dvh-10rem)] xl:overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Task, user, field, value..."
                  className="h-11 border-slate-700 bg-slate-950 pl-9 text-slate-100 placeholder:text-slate-600"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 rounded-md p-1 text-slate-500 transition hover:bg-slate-900 hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Scope
              </label>
              <div className="grid gap-2">
                {scopeOptions.map((scope) => {
                  const Icon = scope.icon;
                  const selected = scopeFilter === scope.value;

                  return (
                    <button
                      key={scope.value}
                      type="button"
                      onClick={() => setScopeFilter(scope.value)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        selected
                          ? "border-blue-500/40 bg-blue-500/10 text-blue-200"
                          : "border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:bg-slate-950"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {scope.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {scope.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Time
                </label>
                <Select
                  value={timeFilter}
                  onValueChange={(value) => setTimeFilter(value as TimeFilter)}
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Time" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="24">Last 24h</SelectItem>
                    <SelectItem value="72">Last 3 days</SelectItem>
                    <SelectItem value="168">Last 7 days</SelectItem>
                    <SelectItem value="720">Last 30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Person
                </label>
                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Person" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="all">Everyone</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    {members.map((member) => (
                      <SelectItem
                        key={member.membership_id}
                        value={String(member.user.id)}
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={member.user.full_name}
                            email={member.user.email}
                            src={member.user.avatar_url}
                            className="h-5 w-5"
                            fallbackClassName="bg-blue-900 text-[9px] text-blue-100"
                          />
                          {member.user.full_name || member.user.email}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Action
                </label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="all">All actions</SelectItem>
                    {availableActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {actionLabel(action)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Field
                </label>
                <Select value={fieldFilter} onValueChange={setFieldFilter}>
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="all">All fields</SelectItem>
                    {availableFields.map((field) => (
                      <SelectItem key={field} value={field}>
                        {field}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Sort
                </label>
                <Select
                  value={sortFilter}
                  onValueChange={(value) => setSortFilter(value as SortFilter)}
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
                    <SelectItem value="newest">Newest first</SelectItem>
                    <SelectItem value="oldest">Oldest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
          <CardHeader className="border-b border-slate-800/80">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-slate-400" />
                  Timeline
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Showing {visibleActivities.length} of {filteredActivities.length} matching events.
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                {scopeFilter !== "all" && (
                  <Badge
                    variant="outline"
                    className="border-blue-500/20 bg-blue-500/10 text-blue-300"
                  >
                    {scopeFilter}
                  </Badge>
                )}
                {searchTerm.trim() && (
                  <Badge
                    variant="outline"
                    className="border-slate-700 bg-slate-950 text-slate-300"
                  >
                    search: {searchTerm.trim()}
                  </Badge>
                )}
                {fieldFilter !== "all" && (
                  <Badge
                    variant="outline"
                    className="border-slate-700 bg-slate-950 text-slate-300"
                  >
                    field: {fieldFilter}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 sm:p-5">
            <div className="min-w-0 space-y-5">
              {visibleActivities.map((item, index) => (
                <ActivityItem
                  key={`${item.id}-${item.task_id}-${item.created_at}`}
                  item={item}
                  isLast={index === visibleActivities.length - 1 && !hasMoreActivities}
                />
              ))}
            </div>

            {hasMoreActivities && (
              <div className="mt-5 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  className="border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900"
                  onClick={() =>
                    setVisibleActivityCount((current) => current + ACTIVITY_PAGE_SIZE)
                  }
                >
                  Show more events
                </Button>
              </div>
            )}

            {filteredActivities.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-12 text-center">
                <SearchX className="mx-auto mb-3 h-10 w-10 text-slate-700" />
                <p className="font-medium text-slate-300">No activity found</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                  Try changing the filters or update a task to generate a fresh audit event.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
