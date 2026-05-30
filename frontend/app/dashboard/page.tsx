"use client";

import Link from "next/link";
import type { ElementType } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  GitPullRequest,
  KanbanSquare,
  Layers3,
  Loader2,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import {
  getMyProjects,
  getProjectDashboard,
  Project,
  ProjectDashboardData,
  DashboardRecentActivity,
  DashboardRiskCard,
  DashboardTaskSummary,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const statusLabels: Record<string, string> = {
  TODO: "To Do",
  IN_PROGRESS: "In Progress",
  REVIEW: "Review",
  DONE: "Done",
};

const actionLabels: Record<string, string> = {
  TASK_CREATED: "created a task",
  TASK_UPDATED: "updated a task",
  SUBTASK_CREATED: "added a subtask",
  SUBTASK_UPDATED: "updated a subtask",
  COMMENT_ADDED: "commented",
  COMMENT_UPDATED: "edited a comment",
  COMMENT_DELETED: "deleted a comment",
};

const severityStyles: Record<DashboardRiskCard["severity"], string> = {
  low: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  high: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

const statusStyles: Record<string, string> = {
  TODO: "border-slate-700 bg-slate-800/70 text-slate-300",
  IN_PROGRESS: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  REVIEW: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  DONE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const priorityStyles: Record<string, string> = {
  LOW: "border-slate-700 bg-slate-800/70 text-slate-300",
  MEDIUM: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  CRITICAL: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

type MetricTone = "blue" | "green" | "purple" | "yellow" | "red";

const metricToneClass: Record<MetricTone, string> = {
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  green: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  purple: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  yellow: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  red: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

function formatRelativeTime(value?: string | null) {
  if (!value) return "recently";
  const date = new Date(value);
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60000);

  if (Number.isNaN(diffMinutes)) return "recently";
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function formatShortDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function getInitials(name?: string | null) {
  if (!name) return "SY";
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "SY";
  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  subtext: string;
  icon: ElementType;
  tone: MetricTone;
}) {
  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">
              {value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{subtext}</p>
          </div>
          <div className={`rounded-2xl border p-3 ${metricToneClass[tone]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalTile({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ElementType;
  tone: MetricTone;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 shadow-sm shadow-slate-950/20 transition-colors hover:bg-slate-900">
      <div className="min-w-0">
        <p className="text-xs text-slate-400">{title}</p>
        <p className="mt-1 text-xl font-bold tracking-tight text-white">{value}</p>
        <p className="mt-1 text-[10px] text-slate-500">{detail}</p>
      </div>
      <div className={`rounded-xl border p-2.5 ${metricToneClass[tone]}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  href,
  action,
}: {
  title: string;
  detail: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
      <p className="font-medium text-slate-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{detail}</p>
      {href && action && (
        <Button className="mt-5 bg-blue-600 hover:bg-blue-700" asChild>
          <Link href={href}>{action}</Link>
        </Button>
      )}
    </div>
  );
}

function TaskRow({ task }: { task: DashboardTaskSummary }) {
  const assigneeName = task.assignee_name || "Unassigned";
  const dueDate = formatShortDate(task.due_date);

  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
      className="group grid gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/40 hover:bg-slate-950 md:grid-cols-[1fr_auto]"
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-slate-700 bg-slate-900 font-mono text-[10px] text-slate-300"
          >
            {task.key}
          </Badge>
          <Badge
            variant="outline"
            className={`border text-[10px] ${
              statusStyles[task.status] || statusStyles.TODO
            }`}
          >
            {statusLabels[task.status] || task.status}
          </Badge>
          <Badge
            variant="outline"
            className={`border text-[10px] ${
              priorityStyles[task.priority] || priorityStyles.MEDIUM
            }`}
          >
            {task.priority}
          </Badge>
        </div>
        <p className="truncate text-sm font-semibold text-white group-hover:text-blue-200">
          {task.title}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {task.story_points ? `${task.story_points} story points` : "No estimate"}
          {dueDate ? ` · due ${dueDate}` : ""}
        </p>
      </div>
      <div className="flex items-center justify-end gap-3">
        <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-[10px] font-bold text-slate-300 md:flex">
          {getInitials(assigneeName)}
        </div>
        <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-300" />
      </div>
    </Link>
  );
}

function ActivityRow({ item }: { item: DashboardRecentActivity }) {
  const actor = item.actor_name || "System";

  return (
    <Link
      href={`/dashboard/tasks/${item.task_id}`}
      className="group grid grid-cols-[44px_1fr_auto] gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/35 hover:bg-slate-950"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200">
        {getInitials(actor)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-blue-500/20 bg-blue-500/10 text-blue-300"
          >
            {actionLabels[item.action] ||
              item.action.replaceAll("_", " ").toLowerCase()}
          </Badge>
          <span className="text-xs text-slate-500">
            {formatRelativeTime(item.created_at)}
          </span>
        </div>
        <p className="truncate text-sm text-slate-300">
          <span className="font-semibold text-white">{actor}</span> on{" "}
          <span className="font-semibold text-blue-300">
            {item.task_key || "TASK"}
          </span>
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-100 group-hover:text-blue-200">
          {item.task_title || "Untitled task"}
        </p>
        {item.field && (
          <p className="mt-2 truncate text-xs text-slate-500">
            {item.field}:{" "}
            <span className="text-slate-400">{item.old_value || "-"}</span>
            {" -> "}
            <span className="text-emerald-300">{item.new_value || "-"}</span>
          </p>
        )}
      </div>
      <div className="flex items-center">
        <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-300" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [dashboard, setDashboard] = useState<ProjectDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State pentru Activitate (închis by default)
  const [isActivityExpanded, setIsActivityExpanded] = useState(false);

  const loadDashboard = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);

      try {
        let selectedProject = currentProject;

        if (!selectedProject) {
          const projects = await getMyProjects();
          selectedProject = projects[0] ?? null;

          if (selectedProject) {
            setCurrentProject(selectedProject);
          }
        }

        setProject(selectedProject);

        if (!selectedProject) {
          setDashboard(null);
          return;
        }

        const remoteDashboard = await getProjectDashboard(selectedProject.id);
        setDashboard(remoteDashboard);
        setProject(remoteDashboard.project);
      } finally {
        setLoading(false);
      }
    },
    [currentProject, setCurrentProject]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useRealtimeEvent((message) => {
    if (!project?.id || (message.project_id && message.project_id !== project.id)) return;

    if (
      message.type === "task.changed" ||
      message.type === "sprint.changed" ||
      message.type === "calendar.changed" ||
      message.type === "user.updated"
    ) {
      loadDashboard(false);
    }
  }, [project?.id, loadDashboard]);

  const metrics = useMemo(
    () =>
      dashboard?.metrics ?? {
        total_tasks: 0,
        active_tasks: 0,
        completed_tasks: 0,
        backlog_tasks: 0,
        unassigned_tasks: 0,
        due_soon_tasks: 0,
        overdue_tasks: 0,
        critical_open_tasks: 0,
        review_tasks: 0,
        completion_rate: 0,
        team_members_count: 0,
        team_health_score: 0,
        total_story_points: 0,
        completed_story_points: 0,
      },
    [dashboard?.metrics]
  );
  const isScrumLike =
    project?.methodology === "SCRUM" || project?.methodology === "SCRUMBAN";

  const statusDistribution = dashboard?.status_distribution || {};
  const totalTasks = metrics?.total_tasks || 0;
  const reviewCount = statusDistribution.REVIEW || 0;
  const inProgressCount = statusDistribution.IN_PROGRESS || 0;
  const todoCount = statusDistribution.TODO || 0;
  const doneCount = statusDistribution.DONE || metrics?.completed_tasks || 0;
  const storyPointProgress = metrics?.total_story_points
    ? Math.round(
        ((metrics.completed_story_points || 0) / metrics.total_story_points) * 100
      )
    : 0;

  const metricCards = useMemo(
    () => [
      {
        title: isScrumLike ? "Velocity Signal" : "Throughput",
        value: isScrumLike
          ? `${metrics?.completed_story_points || 0}/${metrics?.total_story_points || 0}`
          : String(metrics?.completed_tasks || 0),
        subtext: isScrumLike
          ? `${storyPointProgress}% of story points completed`
          : `${metrics?.active_tasks || 0} active items in flow`,
        icon: isScrumLike ? Target : KanbanSquare,
        tone: "blue" as const,
      },
      {
        title: "Completion",
        value: `${metrics?.completion_rate || 0}%`,
        subtext: `${doneCount} of ${totalTasks} tasks completed`,
        icon: CheckCircle2,
        tone: "green" as const,
      },
      {
        title: "My Active Work",
        value: String(dashboard?.my_active_tasks.length || 0),
        subtext: currentUser?.full_name
          ? `Assigned to ${currentUser.full_name}`
          : "Assigned to you",
        icon: Zap,
        tone: "yellow" as const,
      },
      {
        title: "Team Health",
        value: `${metrics?.team_health_score || 0}%`,
        subtext: `${metrics?.team_members_count || 0} members on this project`,
        icon: ShieldCheck,
        tone:
          metrics.team_health_score >= 80
            ? ("green" as const)
            : metrics.team_health_score >= 55
            ? ("yellow" as const)
            : ("red" as const),
      },
    ],
    [
      currentUser?.full_name,
      dashboard?.my_active_tasks.length,
      doneCount,
      isScrumLike,
      metrics,
      storyPointProgress,
      totalTasks,
    ]
  );

  const deliverySignals = [
    {
      title: "Overdue",
      value: String(metrics.overdue_tasks || 0),
      detail: "Open tasks past target date",
      icon: AlertTriangle,
      tone: (metrics.overdue_tasks || 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Due Soon",
      value: String(metrics.due_soon_tasks || 0),
      detail: "Open tasks due in the next 7 days",
      icon: CalendarDays,
      tone: "blue" as const,
    },
    {
      title: "Critical Open",
      value: String(metrics.critical_open_tasks || 0),
      detail: "Critical priority work not done",
      icon: Zap,
      tone: (metrics.critical_open_tasks || 0) > 0 ? ("red" as const) : ("green" as const),
    },
    {
      title: "Review Queue",
      value: String(metrics.review_tasks ?? reviewCount),
      detail: "Items waiting for validation",
      icon: GitPullRequest,
      tone: (metrics.review_tasks || reviewCount) > 0 ? ("yellow" as const) : ("green" as const),
    },
    {
      title: "Unassigned",
      value: String(metrics.unassigned_tasks || 0),
      detail: "Active work without owner",
      icon: UserRound,
      tone: (metrics.unassigned_tasks || 0) > 0 ? ("yellow" as const) : ("green" as const),
    },
    {
      title: "Backlog",
      value: String(metrics.backlog_tasks || 0),
      detail: isScrumLike ? "Items not planned in sprint" : "Intake queue size",
      icon: Layers3,
      tone: "purple" as const,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-blue-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project || !dashboard) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-xl shadow-slate-950/20">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-blue-400" />
          <h2 className="text-2xl font-bold text-white">No project selected</h2>
          <p className="mt-2 text-slate-400">
            Create or select a project to open the workspace.
          </p>
          <Button
            className="mt-6 bg-blue-600 hover:bg-blue-700"
            onClick={() => router.push("/project-wizard")}
          >
            Create Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
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
                  className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                >
                  {metrics.team_health_score}% health
                </Badge>
              </div>
              <h1 className="truncate text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {project.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Delivery overview, personal work queue, project risks and recent team activity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
                asChild
              >
                <Link href="/dashboard/activity">
                  <Activity className="mr-2 h-4 w-4" />
                  Activity
                </Link>
              </Button>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
                asChild
              >
                <Link href="/dashboard/calendar">
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Calendar
                </Link>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/dashboard/board">
                  <KanbanSquare className="mr-2 h-4 w-4" />
                  Open Board
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              subtext={metric.subtext}
              icon={metric.icon}
              tone={metric.tone}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <div className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-blue-400" />
                  Delivery Signals
                </CardTitle>
                <Button variant="ghost" className="text-slate-400 hover:text-white" asChild>
                  <Link href="/dashboard/calendar">Calendar</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
              {deliverySignals.map((signal) => (
                <SignalTile
                  key={signal.title}
                  title={signal.title}
                  value={signal.value}
                  detail={signal.detail}
                  icon={signal.icon}
                  tone={signal.tone}
                />
              ))}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Layers3 className="h-5 w-5 text-blue-400" />
                  Work Distribution
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Current status spread across the project.
                </p>
              </div>
              {isScrumLike && (
                <Button variant="ghost" className="text-slate-400 hover:text-white" asChild>
                  <Link href="/dashboard/backlog">Backlog</Link>
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-5 p-5 md:grid-cols-[1fr_260px]">
              <div className="space-y-4">
                {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((status) => {
                  const count = statusDistribution[status] || 0;
                  const percent = totalTasks
                    ? Math.round((count / totalTasks) * 100)
                    : 0;

                  return (
                    <div key={status} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-300">{statusLabels[status]}</span>
                        <span className="text-slate-500">
                          {count} · {percent}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <p className="text-sm text-slate-400">Review queue</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {reviewCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <p className="text-sm text-slate-400">In progress</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {inProgressCount}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-300" />
                  My Active Tasks
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Focus queue for your current account.
                </p>
              </div>
              <Button variant="ghost" className="text-slate-400 hover:text-white" asChild>
                <Link href="/dashboard/board">View board</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {dashboard.my_active_tasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}

              {dashboard.my_active_tasks.length === 0 && (
                <EmptyState
                  title="No active tasks assigned to you"
                  detail="Your personal queue is clear. Assign a task from the board when work is ready."
                  href="/dashboard/board"
                  action="Open Board"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6 flex flex-col h-fit">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-blue-400" />
                {isScrumLike ? "Active Sprint" : "Flow Status"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {isScrumLike ? (
                dashboard.active_sprint ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-xl font-semibold text-white">
                        {dashboard.active_sprint.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {dashboard.active_sprint.goal || "No sprint goal set."}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                        <p className="text-sm text-slate-400">Tasks</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {dashboard.active_sprint.done_tasks}/
                          {dashboard.active_sprint.total_tasks}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                        <p className="text-sm text-slate-400">Progress</p>
                        <p className="mt-2 text-2xl font-semibold text-white">
                          {dashboard.active_sprint.progress_percent}%
                        </p>
                      </div>
                    </div>

                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${dashboard.active_sprint.progress_percent}%`,
                        }}
                      />
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                      <Link href="/dashboard/board">Open Sprint Board</Link>
                    </Button>
                  </div>
                ) : (
                  <EmptyState
                    title="No active sprint"
                    detail="Start a sprint from the backlog when planning is ready."
                    href="/dashboard/backlog"
                    action="Open Backlog"
                  />
                )
              ) : (
                <div className="grid gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm text-slate-400">Flow load</p>
                      <KanbanSquare className="h-4 w-4 text-blue-400" />
                    </div>
                    <p className="text-2xl font-semibold text-white">
                      {todoCount + inProgressCount + reviewCount}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      active items across the board
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm text-slate-400">Review load</p>
                      <GitPullRequest className="h-4 w-4 text-amber-300" />
                    </div>
                    <p className="text-2xl font-semibold text-white">{reviewCount}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      items waiting for review
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
                AI Risk Radar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {dashboard.risk_cards.map((risk) => (
                <div key={`${risk.title}-${risk.value}`} className="group rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition-colors hover:border-slate-700 hover:bg-slate-950">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">{risk.title}</p>
                      {(risk.status || risk.priority || risk.assignee_name) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {risk.status && (
                            <Badge variant="outline" className={statusStyles[risk.status] || "border-slate-700 text-slate-300"}>
                              {statusLabels[risk.status] || risk.status}
                            </Badge>
                          )}
                          {risk.priority && (
                            <Badge variant="outline" className={priorityStyles[risk.priority] || "border-slate-700 text-slate-300"}>
                              {risk.priority}
                            </Badge>
                          )}
                          {risk.assignee_name && (
                            <span className="text-xs text-slate-500">{risk.assignee_name}</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge
                        variant="outline"
                        className={severityStyles[risk.severity]}
                      >
                        {risk.value}
                      </Badge>
                      {risk.task_id && (
                        <Link
                          href={`/dashboard/tasks/${risk.task_id}`}
                          className="rounded-full border border-slate-800 p-1.5 text-slate-500 transition-colors hover:border-blue-500/40 hover:text-blue-300"
                          aria-label={`Open ${risk.task_key || "task"}`}
                        >
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">{risk.detail}</p>
                  {risk.category && (
                    <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                      {risk.category} signal
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* PROJECT ACTIVITY (Aici avem logica de minimized/expanded) */}
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <div 
              className="flex cursor-pointer items-center justify-between p-6 transition-colors hover:bg-slate-800/50"
              onClick={() => setIsActivityExpanded(!isActivityExpanded)}
            >
              <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
                <Activity className="h-5 w-5 text-cyan-300" />
                Activity
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" className="hidden h-8 px-2 text-xs text-slate-400 hover:text-white sm:flex" asChild onClick={(e) => e.stopPropagation()}>
                  <Link href="/dashboard/activity">View all</Link>
                </Button>
                {isActivityExpanded ? (
                  <ChevronUp className="h-5 w-5 text-slate-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                )}
              </div>
            </div>

            {/* Doar dacă este setat pe `true` arătăm conținutul */}
            {isActivityExpanded && (
              <>
                <div className="border-t border-slate-800/80" />
                <CardContent className="p-5">
                  {dashboard.recent_activity.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {dashboard.recent_activity.slice(0, 6).map((item) => (
                        <ActivityRow key={`${item.id}-${item.task_id}`} item={item} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No activity yet"
                      detail="Updates will appear here."
                      href="/dashboard/board"
                      action="Open Board"
                    />
                  )}
                </CardContent>
              </>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
