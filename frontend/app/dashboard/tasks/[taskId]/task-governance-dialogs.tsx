"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskDetail } from "@/services/task";

type TaskGovernanceDialogsProps = {
  task: TaskDetail;
  invalidateEstimateOpen: boolean;
  deleteTaskOpen: boolean;
  subtaskDeleteOpen: boolean;
  commentDeleteOpen: boolean;
  invalidateEstimateReason: string;
  deleteTaskReason: string;
  deleteTaskConfirmKey: string;
  invalidatingEstimate: boolean;
  deletingTask: boolean;
  deletingSubtask: boolean;
  deletingComment: boolean;
  onInvalidateEstimateOpenChange: (open: boolean) => void;
  onDeleteTaskOpenChange: (open: boolean) => void;
  onSubtaskDeleteOpenChange: (open: boolean) => void;
  onCommentDeleteOpenChange: (open: boolean) => void;
  onInvalidateEstimateReasonChange: (value: string) => void;
  onDeleteTaskReasonChange: (value: string) => void;
  onDeleteTaskConfirmKeyChange: (value: string) => void;
  onConfirmInvalidateEstimate: () => void;
  onConfirmDeleteTask: () => void;
  onConfirmDeleteSubtask: () => void;
  onConfirmDeleteComment: () => void;
};

export function TaskGovernanceDialogs({
  task,
  invalidateEstimateOpen,
  deleteTaskOpen,
  subtaskDeleteOpen,
  commentDeleteOpen,
  invalidateEstimateReason,
  deleteTaskReason,
  deleteTaskConfirmKey,
  invalidatingEstimate,
  deletingTask,
  deletingSubtask,
  deletingComment,
  onInvalidateEstimateOpenChange,
  onDeleteTaskOpenChange,
  onSubtaskDeleteOpenChange,
  onCommentDeleteOpenChange,
  onInvalidateEstimateReasonChange,
  onDeleteTaskReasonChange,
  onDeleteTaskConfirmKeyChange,
  onConfirmInvalidateEstimate,
  onConfirmDeleteTask,
  onConfirmDeleteSubtask,
  onConfirmDeleteComment,
}: TaskGovernanceDialogsProps) {
  return (
    <>
      <Dialog open={invalidateEstimateOpen} onOpenChange={onInvalidateEstimateOpenChange}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Invalidate estimate</DialogTitle>
            <DialogDescription className="text-slate-400">
              This clears the current story points and writes a dedicated governance event in the task audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea
              value={invalidateEstimateReason}
              onChange={(event) => onInvalidateEstimateReasonChange(event.target.value)}
              placeholder="Example: scope changed after API review, previous estimate is no longer valid."
              className="min-h-28 border-slate-700 bg-slate-900"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white"
              disabled={invalidatingEstimate}
              onClick={() => onInvalidateEstimateOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={invalidatingEstimate || invalidateEstimateReason.trim().length < 8}
              onClick={onConfirmInvalidateEstimate}
            >
              {invalidatingEstimate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Invalidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTaskOpen} onOpenChange={onDeleteTaskOpenChange}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Delete {task.key}?</DialogTitle>
            <DialogDescription className="text-slate-400">
              This action is governance protected. The task will be removed from the workspace and the deletion reason will remain in the project audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl border border-rose-500/20 bg-rose-950/20 p-4">
              <p className="text-sm font-semibold text-rose-100">{task.title}</p>
              <p className="mt-1 text-xs leading-5 text-rose-200/70">
                Type <span className="font-mono text-rose-100">{task.key}</span> below to confirm deletion.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Deletion reason</Label>
              <Textarea
                value={deleteTaskReason}
                onChange={(event) => onDeleteTaskReasonChange(event.target.value)}
                placeholder="Explain why this task is being deleted."
                className="min-h-28 border-slate-700 bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmation key</Label>
              <Input
                value={deleteTaskConfirmKey}
                onChange={(event) => onDeleteTaskConfirmKeyChange(event.target.value)}
                placeholder={task.key}
                className="h-11 border-slate-700 bg-slate-900 font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white"
              disabled={deletingTask}
              onClick={() => onDeleteTaskOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              disabled={
                deletingTask ||
                deleteTaskReason.trim().length < 8 ||
                deleteTaskConfirmKey.trim().toUpperCase() !== task.key.toUpperCase()
              }
              onClick={onConfirmDeleteTask}
            >
              {deletingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={subtaskDeleteOpen}
        onOpenChange={onSubtaskDeleteOpenChange}
        title="Delete subtask?"
        description="This removes the subtask from the issue. The task audit trail will keep the deletion event."
        confirmLabel="Delete Subtask"
        destructive
        loading={deletingSubtask}
        onConfirm={onConfirmDeleteSubtask}
      />

      <ConfirmDialog
        open={commentDeleteOpen}
        onOpenChange={onCommentDeleteOpenChange}
        title="Delete comment?"
        description="This removes the comment from the issue discussion. The audit trail will still record the action."
        confirmLabel="Delete Comment"
        destructive
        loading={deletingComment}
        onConfirm={onConfirmDeleteComment}
      />
    </>
  );
}
