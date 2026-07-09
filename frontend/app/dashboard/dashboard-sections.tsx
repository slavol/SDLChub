"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Clock3,
  GitPullRequest,
  KanbanSquare,
  Layers3,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Project, ProjectDashboardData } from "@/services/project";
import { ActivityRow, EmptyState, MetricCard, SignalTile, TaskRow } from "./dashboard-components";
import {
  priorityStyles,
  severityStyles,
  statusLabels,
  statusStyles,
  type DashboardMetricCardConfig,
  type DashboardSignalConfig,
} from "./dashboard-utils";

// Sectiunile grupeaza blocurile mari ale dashboard-ului; pagina principala ramane doar orchestratorul datelor.
export function DashboardHero({
  project,
  healthScore,
  metricCards,
}: {
  project: Project;
  healthScore: number;
  metricCards: DashboardMetricCardConfig[];
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
      <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="bg-blue-600 text-white">{project.key}</Badge>
              <Badge variant="outline" className="border-slate-700 bg-slate-950/70 text-slate-300">
                {project.methodology}
              </Badge>
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                {healthScore}% health
              </Badge>
            </div>
            <h1 className="truncate text-3xl font-semibold tracking-tight text-white md:text-4xl">{project.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Delivery overview, personal work queue, project risks and recent team activity.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button variant="outline" className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 sm:w-auto" asChild>
              <Link href="/dashboard/activity">
                <Activity className="mr-2 h-4 w-4" />
                Activity
              </Link>
            </Button>
            <Button variant="outline" className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 sm:w-auto" asChild>
              <Link href="/dashboard/calendar">
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendar
              </Link>
            </Button>
            <Button className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto" asChild>
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
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>
    </section>
  );
}

export function DeliverySignalsCard({ signals }: { signals: DashboardSignalConfig[] }) {
  return (
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
        {signals.map((signal) => (
          <SignalTile key={signal.title} {...signal} />
        ))}
      </CardContent>
    </Card>
  );
}

export function WorkDistributionCard({
  isScrumLike,
  statusDistribution,
  totalTasks,
  reviewCount,
  inProgressCount,
}: {
  isScrumLike: boolean;
  statusDistribution: Record<string, number>;
  totalTasks: number;
  reviewCount: number;
  inProgressCount: number;
}) {
  return (
    <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-blue-400" />
            Work Distribution
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">Current status spread across the project.</p>
        </div>
        {isScrumLike && (
          <Button variant="ghost" className="text-slate-400 hover:text-white" asChild>
            <Link href="/dashboard/backlog">Backlog</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid min-w-0 gap-5 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((status) => {
            const count = statusDistribution[status] || 0;
            const percent = totalTasks ? Math.round((count / totalTasks) * 100) : 0;

            return (
              <div key={status} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">{statusLabels[status]}</span>
                  <span className="text-slate-500">
                    {count} · {percent}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <p className="text-sm text-slate-400">Review queue</p>
            <p className="mt-2 text-2xl font-semibold text-white">{reviewCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <p className="text-sm text-slate-400">In progress</p>
            <p className="mt-2 text-2xl font-semibold text-white">{inProgressCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function MyActiveTasksCard({ tasks }: { tasks: ProjectDashboardData["my_active_tasks"] }) {
  return (
    <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="flex flex-col gap-4 border-b border-slate-800/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-300" />
            My Active Tasks
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">Focus queue for your current account.</p>
        </div>
        <Button variant="ghost" className="w-full text-slate-400 hover:text-white sm:w-auto" asChild>
          <Link href="/dashboard/board">View board</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-5">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} />
        ))}

        {tasks.length === 0 && (
          <EmptyState
            title="No active tasks assigned to you"
            detail="Your personal queue is clear. Assign a task from the board when work is ready."
            href="/dashboard/board"
            action="Open Board"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function FlowStatusCard({
  dashboard,
  isScrumLike,
  todoCount,
  inProgressCount,
  reviewCount,
}: {
  dashboard: ProjectDashboardData;
  isScrumLike: boolean;
  todoCount: number;
  inProgressCount: number;
  reviewCount: number;
}) {
  return (
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
                <h3 className="text-xl font-semibold text-white">{dashboard.active_sprint.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{dashboard.active_sprint.goal || "No sprint goal set."}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <p className="text-sm text-slate-400">Tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {dashboard.active_sprint.done_tasks}/{dashboard.active_sprint.total_tasks}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <p className="text-sm text-slate-400">Progress</p>
                  <p className="mt-2 text-2xl font-semibold text-white">{dashboard.active_sprint.progress_percent}%</p>
                </div>
              </div>

              <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${dashboard.active_sprint.progress_percent}%` }} />
              </div>

              <Button className="w-full bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/dashboard/board">Open Sprint Board</Link>
              </Button>
            </div>
          ) : (
            <EmptyState title="No active sprint" detail="Start a sprint from the backlog when planning is ready." href="/dashboard/backlog" action="Open Backlog" />
          )
        ) : (
          <div className="grid gap-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-400">Flow load</p>
                <KanbanSquare className="h-4 w-4 text-blue-400" />
              </div>
              <p className="text-2xl font-semibold text-white">{todoCount + inProgressCount + reviewCount}</p>
              <p className="mt-1 text-xs text-slate-500">active items across the board</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-slate-400">Review load</p>
                <GitPullRequest className="h-4 w-4 text-amber-300" />
              </div>
              <p className="text-2xl font-semibold text-white">{reviewCount}</p>
              <p className="mt-1 text-xs text-slate-500">items waiting for review</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RiskRadarCard({ dashboard }: { dashboard: ProjectDashboardData }) {
  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 lg:col-span-2 xl:col-span-2">
      <CardHeader className="border-b border-slate-800/80 bg-slate-950/25">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              AI Risk Radar
            </CardTitle>
            <p className="mt-1 text-sm text-slate-500">Delivery, deadline and methodology signals.</p>
          </div>
          <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-200">
            {dashboard.risk_cards.length} signals
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid gap-3 md:grid-cols-2">
          {dashboard.risk_cards.map((risk) => (
            <div
              key={`${risk.title}-${risk.value}`}
              className="group flex min-w-0 gap-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition-colors hover:border-slate-700 hover:bg-slate-950"
            >
              <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)]" />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{risk.title}</p>
                    {(risk.status || risk.priority || risk.assignee_name) && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
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
                        {risk.assignee_name && <span className="truncate text-xs text-slate-500">{risk.assignee_name}</span>}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="outline" className={severityStyles[risk.severity]}>
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
                <p className="mt-2 break-words text-sm leading-5 text-slate-400">{risk.detail}</p>
                {risk.category && <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-slate-600">{risk.category} signal</p>}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardActivityCard({
  dashboard,
  isExpanded,
  onToggle,
}: {
  dashboard: ProjectDashboardData;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 lg:col-span-2 xl:col-span-3">
      <div className="flex cursor-pointer items-center justify-between border-b border-slate-800/80 bg-slate-950/25 p-5 transition-colors hover:bg-slate-900" onClick={onToggle}>
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold leading-none tracking-tight">
            <Activity className="h-5 w-5 text-cyan-300" />
            Activity
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">Latest team changes and audit entries.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="hidden h-8 px-2 text-xs text-slate-400 hover:text-white sm:flex" asChild onClick={(event) => event.stopPropagation()}>
            <Link href="/dashboard/activity">View all</Link>
          </Button>
          {isExpanded ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
        </div>
      </div>

      {isExpanded && (
        <CardContent className="p-5">
          {dashboard.recent_activity.length > 0 ? (
            <div className="flex flex-col gap-3">
              {dashboard.recent_activity.slice(0, 6).map((item) => (
                <ActivityRow key={`${item.id}-${item.task_id}`} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState title="No activity yet" detail="Updates will appear here." href="/dashboard/board" action="Open Board" />
          )}
        </CardContent>
      )}
    </Card>
  );
}
