"use client";

import { CalendarClock, ClipboardList, Flag, Gauge, UserRound } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { TaskDetail } from "@/services/task";
import { formatTaskDate, statusLabels } from "./task-detail-utils";

type TaskDetailMetricsProps = {
  task: TaskDetail;
  supportsStoryPoints: boolean;
  assigneeName: string;
};

export function TaskDetailMetrics({ task, supportsStoryPoints, assigneeName }: TaskDetailMetricsProps) {
  return (
    <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <ClipboardList className="mb-3 h-5 w-5 text-blue-300" />
        <p className="text-sm text-slate-500">Status</p>
        <p className="mt-1 text-lg font-semibold text-white">{statusLabels[task.status]}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <Flag className="mb-3 h-5 w-5 text-orange-300" />
        <p className="text-sm text-slate-500">Priority</p>
        <p className="mt-1 text-lg font-semibold text-white">{task.priority}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <Gauge className="mb-3 h-5 w-5 text-emerald-300" />
        <p className="text-sm text-slate-500">Estimate</p>
        <p className="mt-1 text-lg font-semibold text-white">
          {supportsStoryPoints ? (task.story_points ? `${task.story_points} pts` : "No estimate") : "Disabled"}
        </p>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <CalendarClock className="mb-3 h-5 w-5 text-amber-300" />
        <p className="text-sm text-slate-500">Target Date</p>
        <p className="mt-1 text-lg font-semibold text-white">{task.due_date ? formatTaskDate(task.due_date) : "No date"}</p>
      </div>
      <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <UserRound className="mb-3 h-5 w-5 text-violet-300" />
        <p className="text-sm text-slate-500">Assignee</p>
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <UserAvatar
            name={assigneeName}
            src={task.assignee_avatar_url}
            className="h-8 w-8"
            fallbackClassName="bg-violet-500/10 text-[10px] text-violet-200"
          />
          <p className="truncate text-lg font-semibold text-white">{assigneeName}</p>
        </div>
      </div>
    </div>
  );
}
