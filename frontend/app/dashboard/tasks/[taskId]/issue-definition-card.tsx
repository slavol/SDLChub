"use client";

import { Loader2, Sparkles, ClipboardList } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { formatAiSource } from "@/lib/ai-source";
import { cn } from "@/lib/utils";
import { TaskDetail } from "@/services/task";

export type IssueAiStatusMessage = {
  tone: "success" | "fallback";
  title: string;
  detail: string;
  source?: string;
};

type IssueDefinitionCardProps = {
  task: TaskDetail;
  canUseAi: boolean;
  canUpdateTask: boolean;
  aiWorking: boolean;
  aiStatusMessage: IssueAiStatusMessage | null;
  patchLocalTask: (updates: Partial<TaskDetail>) => void;
  onRefineWithAi: () => void;
};

export function IssueDefinitionCard({
  task,
  canUseAi,
  canUpdateTask,
  aiWorking,
  aiStatusMessage,
  patchLocalTask,
  onRefineWithAi,
}: IssueDefinitionCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="border-b border-slate-800/80">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-blue-400" />
          Issue Definition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="space-y-2">
          <Label>Title</Label>
          <Input
            value={task.title}
            onChange={(event) => patchLocalTask({ title: event.target.value })}
            disabled={!canUpdateTask}
            className="h-12 border-slate-700 bg-slate-950 text-base font-semibold text-white"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Description</Label>
            {canUseAi && canUpdateTask && (
              <button
                type="button"
                onClick={onRefineWithAi}
                disabled={aiWorking}
                className="inline-flex items-center text-xs text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
              >
                {aiWorking ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                Refine & save
              </button>
            )}
          </div>
          <RichTextEditor
            value={task.description || ""}
            onChange={(value) => patchLocalTask({ description: value })}
            disabled={!canUpdateTask}
            placeholder="User story, acceptance criteria, technical notes..."
            editorClassName="[&_.ProseMirror]:min-h-[260px]"
          />
          {aiStatusMessage && (
            <div
              className={cn(
                "rounded-2xl border p-4 text-sm",
                aiStatusMessage.tone === "fallback"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-50"
                  : "border-emerald-500/20 bg-emerald-500/10 text-emerald-50"
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-semibold">{aiStatusMessage.title}</p>
                {aiStatusMessage.source && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit border text-xs",
                      aiStatusMessage.tone === "fallback"
                        ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
                        : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
                    )}
                  >
                    {formatAiSource(aiStatusMessage.source)}
                  </Badge>
                )}
              </div>
              <p className="mt-2 leading-6 opacity-80">{aiStatusMessage.detail}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
