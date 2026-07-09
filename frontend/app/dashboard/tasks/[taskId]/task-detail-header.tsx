"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, Save, Sparkles, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Project } from "@/services/project";
import { TaskDetail } from "@/services/task";
import { formatTaskDate, priorityClass, statusClass, statusLabels } from "./task-detail-utils";

type TaskDetailHeaderProps = {
  task: TaskDetail;
  project: Project | null;
  completedSubtasks: number;
  canSaveTask: boolean;
  canUseAi: boolean;
  canUpdateTask: boolean;
  canDeleteTask: boolean;
  saving: boolean;
  aiWorking: boolean;
  onSave: () => void;
  onRefineWithAi: () => void;
  onRequestDelete: () => void;
};

export function TaskDetailHeader({
  task,
  project,
  completedSubtasks,
  canSaveTask,
  canUseAi,
  canUpdateTask,
  canDeleteTask,
  saving,
  aiWorking,
  onSave,
  onRefineWithAi,
  onRequestDelete,
}: TaskDetailHeaderProps) {
  return (
    <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link href="/dashboard/board" className="mb-4 inline-flex items-center text-sm text-slate-400 transition hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to board
          </Link>

          {/* Badges-urile de context raman grupate langa titlu pentru scanare rapida. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="bg-blue-600 text-white">{task.key}</Badge>
            <Badge variant="outline" className={cn("border", statusClass[task.status])}>
              {statusLabels[task.status]}
            </Badge>
            <Badge variant="outline" className={cn("border", priorityClass[task.priority])}>
              {task.priority}
            </Badge>
            <Badge variant="outline" className="border-slate-700 bg-slate-950/70 text-slate-300">
              {project?.methodology || "Project"}
            </Badge>
            {task.team_name && (
              <Badge variant="outline" className="border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
                {task.team_name}
              </Badge>
            )}
          </div>

          <h1 className="break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
            {task.title}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Created {formatTaskDate(task.created_at)} · {completedSubtasks}/{task.subtasks.length} subtasks complete
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
          <Button onClick={onSave} disabled={saving || !canSaveTask} className="h-11 w-full bg-blue-600 hover:bg-blue-700 sm:w-auto">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
          {canUseAi && canUpdateTask && (
            <Button
              variant="outline"
              onClick={onRefineWithAi}
              disabled={aiWorking}
              className="h-11 w-full border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900 sm:w-auto"
            >
              {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Refine & save
            </Button>
          )}
          {canDeleteTask && (
            <Button
              variant="outline"
              onClick={onRequestDelete}
              className="h-11 w-full border-rose-500/30 bg-rose-950/20 text-rose-200 hover:bg-rose-950/40 hover:text-rose-100 sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
