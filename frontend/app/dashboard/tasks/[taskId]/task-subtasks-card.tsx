"use client";

import {
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
  Loader2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatAiSource } from "@/lib/ai-source";
import { RefinedTaskSpec, Subtask } from "@/services/task";

type TaskSubtasksCardProps = {
  subtasks: Subtask[];
  completedSubtasks: number;
  subtaskProgress: number;
  aiSuggestedSubtasks: string[];
  lastRefinedSpec: RefinedTaskSpec | null;
  aiWorking: boolean;
  canUpdateTask: boolean;
  newSubtaskTitle: string;
  editingSubtaskId: number | null;
  editingSubtaskTitle: string;
  onNewSubtaskTitleChange: (value: string) => void;
  onEditingSubtaskTitleChange: (value: string) => void;
  onCancelSubtaskEdit: () => void;
  onApplyAiSubtasks: () => void;
  onAddSubtask: () => void;
  onStartEditSubtask: (subtaskId: number, title: string) => void;
  onSaveSubtaskEdit: () => void;
  onRequestDeleteSubtask: (subtaskId: number) => void;
  onToggleSubtask: (subtaskId: number, isDone: boolean) => void;
};

export function TaskSubtasksCard({
  subtasks,
  completedSubtasks,
  subtaskProgress,
  aiSuggestedSubtasks,
  lastRefinedSpec,
  aiWorking,
  canUpdateTask,
  newSubtaskTitle,
  editingSubtaskId,
  editingSubtaskTitle,
  onNewSubtaskTitleChange,
  onEditingSubtaskTitleChange,
  onCancelSubtaskEdit,
  onApplyAiSubtasks,
  onAddSubtask,
  onStartEditSubtask,
  onSaveSubtaskEdit,
  onRequestDeleteSubtask,
  onToggleSubtask,
}: TaskSubtasksCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-800/80 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            Subtasks
          </CardTitle>
          <p className="mt-1 text-sm text-slate-500">Subtask progress for this issue.</p>
        </div>
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Badge className="bg-slate-800 text-slate-300">
            {completedSubtasks}/{subtasks.length} done
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-5">
        {aiSuggestedSubtasks.length > 0 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-emerald-100">AI suggested subtasks</p>
                <p className="mt-1 text-xs text-emerald-100/70">
                  Create these as real subtasks.
                  {lastRefinedSpec?.source ? ` Source: ${formatAiSource(lastRefinedSpec.source)}.` : ""}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={onApplyAiSubtasks}
                disabled={aiWorking || !canUpdateTask}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {aiWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create subtasks
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {aiSuggestedSubtasks.slice(0, 8).map((subtask) => (
                <div
                  key={subtask}
                  className="break-words rounded-xl border border-emerald-400/15 bg-slate-950/50 px-3 py-2 text-xs text-emerald-50/85"
                >
                  {subtask}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Progress value={subtaskProgress} className="h-2 bg-slate-800 [&>div]:bg-emerald-500" />
          <p className="text-xs text-slate-500">{subtaskProgress}% complete</p>
        </div>

        <div className="space-y-2">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/30 hover:bg-slate-950"
            >
              {editingSubtaskId === subtask.id ? (
                <div className="space-y-3">
                  <Input
                    value={editingSubtaskTitle}
                    onChange={(event) => onEditingSubtaskTitleChange(event.target.value)}
                    disabled={!canUpdateTask}
                    className="h-11 border-slate-700 bg-slate-900"
                  />
                  <div className="flex flex-col justify-end gap-2 sm:flex-row">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={onCancelSubtaskEdit}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={onSaveSubtaskEdit}
                      disabled={!canUpdateTask || !editingSubtaskTitle.trim()}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleSubtask(subtask.id, subtask.is_done)}
                    disabled={!canUpdateTask}
                    className="mt-0.5 shrink-0 text-left disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={subtask.is_done ? "Mark subtask as not done" : "Mark subtask as done"}
                  >
                    {subtask.is_done ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-500" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => onToggleSubtask(subtask.id, subtask.is_done)}
                      disabled={!canUpdateTask}
                      className="block w-full text-left disabled:cursor-not-allowed"
                    >
                      <span className={subtask.is_done ? "text-slate-500 line-through" : "text-slate-200"}>
                        {subtask.title}
                      </span>
                    </button>
                    <p className="mt-1 text-xs text-slate-600">
                      Added by {subtask.created_by_name || "Unknown user"}
                    </p>
                  </div>
                  {canUpdateTask && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-900 hover:text-white">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="border-slate-800 bg-slate-950 text-slate-200">
                        <DropdownMenuItem
                          className="cursor-pointer hover:bg-slate-900"
                          onClick={() => onStartEditSubtask(subtask.id, subtask.title)}
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => onRequestDeleteSubtask(subtask.id)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
            </div>
          ))}

          {subtasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-400">No subtasks yet</p>
              <p className="mt-1 text-xs text-slate-600">Break the issue into implementation steps.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={newSubtaskTitle}
            onChange={(event) => onNewSubtaskTitleChange(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && onAddSubtask()}
            placeholder="Add a subtask..."
            disabled={!canUpdateTask}
            className="h-11 border-slate-700 bg-slate-950"
          />
          <Button onClick={onAddSubtask} disabled={!canUpdateTask} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-11">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
