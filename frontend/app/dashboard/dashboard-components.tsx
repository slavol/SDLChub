"use client";

import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { AuditChangeSummary, formatAuditActionLabel } from "@/components/dashboard/audit-log-event";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardRecentActivity, DashboardTaskSummary } from "@/services/project";
import {
  formatRelativeTime,
  formatShortDate,
  getInitials,
  metricToneClass,
  priorityStyles,
  statusLabels,
  statusStyles,
  type DashboardMetricCardConfig,
  type DashboardSignalConfig,
} from "./dashboard-utils";

// Componentele mici de prezentare sunt tinute aici ca sectiunile principale sa nu repete aceleasi carduri.
export function MetricCard({ title, value, subtext, icon: Icon, tone }: DashboardMetricCardConfig) {
  return (
    <Card className="overflow-hidden border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-400">{title}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-white">{value}</p>
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

export function SignalTile({ title, value, detail, icon: Icon, tone }: DashboardSignalConfig) {
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

export function EmptyState({
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

// Rand comun pentru task-uri, folosit in dashboard fara sa copieze logica de badge-uri si avatar.
export function TaskRow({ task }: { task: DashboardTaskSummary }) {
  const assigneeName = task.assignee_name || "Unassigned";
  const dueDate = formatShortDate(task.due_date);

  return (
    <Link
      href={`/dashboard/tasks/${task.id}`}
      className="group grid min-w-0 gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/40 hover:bg-slate-950 md:grid-cols-[minmax(0,1fr)_auto]"
    >
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-700 bg-slate-900 font-mono text-[10px] text-slate-300">
            {task.key}
          </Badge>
          <Badge variant="outline" className={`border text-[10px] ${statusStyles[task.status] || statusStyles.TODO}`}>
            {statusLabels[task.status] || task.status}
          </Badge>
          <Badge variant="outline" className={`border text-[10px] ${priorityStyles[task.priority] || priorityStyles.MEDIUM}`}>
            {task.priority}
          </Badge>
        </div>
        <p className="truncate text-sm font-semibold text-white group-hover:text-blue-200">{task.title}</p>
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

// Rand comun pentru activitate, cu sumarul audit-log deja formatat in componenta dedicata.
export function ActivityRow({ item }: { item: DashboardRecentActivity }) {
  const actor = item.actor_name || "System";

  return (
    <Link
      href={`/dashboard/tasks/${item.task_id}`}
      className="group flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/35 hover:bg-slate-950"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm font-semibold text-slate-200">
        {getInitials(actor)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-300">
            {formatAuditActionLabel(item.action)}
          </Badge>
          <span className="text-xs text-slate-500">{formatRelativeTime(item.created_at)}</span>
        </div>
        <p className="truncate text-sm text-slate-300">
          <span className="font-semibold text-white">{actor}</span> on{" "}
          <span className="font-semibold text-blue-300">{item.task_key || "TASK"}</span>
        </p>
        <p className="mt-1 truncate text-sm font-medium text-slate-100 group-hover:text-blue-200">
          {item.task_title || "Untitled task"}
        </p>
        <AuditChangeSummary event={item} />
      </div>
      <div className="flex shrink-0 items-center">
        <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:translate-x-1 group-hover:text-blue-300" />
      </div>
    </Link>
  );
}

// Skeleton-ul pastreaza aceeasi structura vizuala ca pagina finala, ca incarcarea sa nu para o schimbare brusca.
export function DashboardPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-11 w-72 max-w-full" />
              <Skeleton className="h-5 w-[34rem] max-w-full" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-28 rounded-xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-slate-900/80">
        <div className="border-b border-slate-800 p-5">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 rounded-xl" />
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
