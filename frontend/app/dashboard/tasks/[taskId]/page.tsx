"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Circle,
  ClipboardList,
  Flag,
  Gauge,
  History,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  getProjectDetail,
  getProjectMembers,
  Project,
  ProjectMember,
} from "@/services/project";
import {
  createSubtask,
  createTaskComment,
  deleteTaskComment,
  getTaskDetail,
  TaskDetail,
  TaskPriority,
  TaskStatus,
  updateSubtask,
  updateTask,
  updateTaskComment,
} from "@/services/task";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const priorityOptions = Object.values(TaskPriority);
const statusOptions = Object.values(TaskStatus);

const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.REVIEW]: "Review",
  [TaskStatus.DONE]: "Done",
};

const statusClass: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskStatus.IN_PROGRESS]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskStatus.REVIEW]: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  [TaskStatus.DONE]: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const priorityClass: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskPriority.MEDIUM]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskPriority.HIGH]: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  [TaskPriority.CRITICAL]: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

function getInitials(name?: string | null) {
  if (!name) return "U";

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "U";

  return parts.map((part) => part[0]?.toUpperCase()).join("");
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

function actionLabel(action: string) {
  return (
    {
      TASK_CREATED: "Created task",
      TASK_UPDATED: "Updated task",
      SUBTASK_CREATED: "Added subtask",
      SUBTASK_UPDATED: "Updated subtask",
      COMMENT_ADDED: "Commented",
      COMMENT_UPDATED: "Edited comment",
      COMMENT_DELETED: "Deleted comment",
    }[action] || action.replaceAll("_", " ").toLowerCase()
  );
}

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();
  const taskId = Number(params.taskId);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [project, setProject] = useState<Project | null>(currentProject);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

  const supportsStoryPoints = project?.methodology !== "KANBAN";

  const completedSubtasks = useMemo(
    () => task?.subtasks.filter((subtask) => subtask.is_done).length || 0,
    [task?.subtasks]
  );

  const subtaskProgress = task?.subtasks.length
    ? Math.round((completedSubtasks / task.subtasks.length) * 100)
    : 0;

  const assigneeName = task?.assignee_name || "Unassigned";

  const loadTask = useCallback(async () => {
    if (!taskId) return;

    setLoading(true);
    try {
      const data = await getTaskDetail(taskId);
      setTask(data);

      const [projectMembers, detailProject] = await Promise.all([
        getProjectMembers(data.project_id).catch(() => []),
        currentProject?.id === data.project_id
          ? Promise.resolve(currentProject)
          : getProjectDetail(data.project_id).catch(() => null),
      ]);

      setMembers(projectMembers);

      if (detailProject) {
        setProject(detailProject);

        if (currentProject?.id !== detailProject.id) {
          setCurrentProject(detailProject);
        }
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load task."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, setCurrentProject, taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  const patchLocalTask = (updates: Partial<TaskDetail>) => {
    setTask((current) => (current ? { ...current, ...updates } : current));
  };

  const handleSave = async () => {
    if (!task) return;

    setSaving(true);
    try {
      const payload = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignee_id: task.assignee_id || 0,
        due_date: task.due_date,
        ...(supportsStoryPoints ? { story_points: task.story_points } : {}),
      };

      const updated = await updateTask(task.id, payload);
      patchLocalTask(updated);
      await loadTask();
      toast.success("Task saved");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save task."));
    } finally {
      setSaving(false);
    }
  };

  const handleAssigneeChange = (value: string) => {
    const assigneeId = value === "unassigned" ? undefined : Number(value);
    const member = members.find((item) => item.user.id === assigneeId);

    patchLocalTask({
      assignee_id: assigneeId,
      assignee_name: member?.user.full_name || null,
    });
  };

  const handleAddSubtask = async () => {
    if (!task || !newSubtaskTitle.trim()) return;

    try {
      await createSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle("");
      await loadTask();
      toast.success("Subtask added");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add subtask."));
    }
  };

  const handleToggleSubtask = async (subtaskId: number, isDone: boolean) => {
    if (!task) return;

    try {
      await updateSubtask(task.id, subtaskId, { is_done: !isDone });
      await loadTask();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update subtask."));
    }
  };

  const handleAddComment = async () => {
    if (!task || !newComment.trim()) return;

    try {
      await createTaskComment(task.id, newComment.trim());
      setNewComment("");
      await loadTask();
      toast.success("Comment added");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add comment."));
    }
  };

  const handleStartEditComment = (commentId: number, body: string) => {
    setEditingCommentId(commentId);
    setEditingCommentBody(body);
  };

  const handleSaveCommentEdit = async () => {
    if (!task || !editingCommentId || !editingCommentBody.trim()) return;

    try {
      await updateTaskComment(task.id, editingCommentId, editingCommentBody.trim());
      setEditingCommentId(null);
      setEditingCommentBody("");
      await loadTask();
      toast.success("Comment updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update comment."));
    }
  };

  const handleDeleteComment = async () => {
    if (!task) return;
    if (!commentToDelete) return;

    setDeletingComment(true);
    try {
      await deleteTaskComment(task.id, commentToDelete);
      setCommentToDelete(null);
      await loadTask();
      toast.success("Comment deleted");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete comment."));
    } finally {
      setDeletingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-blue-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-300">
        <p>Task not found.</p>
        <Button onClick={() => router.back()} variant="outline">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <Link
                href="/dashboard/board"
                className="mb-4 inline-flex items-center text-sm text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to board
              </Link>

              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">{task.key}</Badge>
                <Badge
                  variant="outline"
                  className={cn("border", statusClass[task.status])}
                >
                  {statusLabels[task.status]}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("border", priorityClass[task.priority])}
                >
                  {task.priority}
                </Badge>
                <Badge
                  variant="outline"
                  className="border-slate-700 bg-slate-950/70 text-slate-300"
                >
                  {project?.methodology || "Project"}
                </Badge>
              </div>

              <h1 className="break-words text-3xl font-semibold tracking-tight text-white md:text-4xl">
                {task.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Created {formatDate(task.created_at)} · {completedSubtasks}/
                {task.subtasks.length} subtasks complete
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save changes
            </Button>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <ClipboardList className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {statusLabels[task.status]}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <Flag className="mb-3 h-5 w-5 text-orange-300" />
            <p className="text-sm text-slate-500">Priority</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {task.priority}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <Gauge className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-sm text-slate-500">Estimate</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {supportsStoryPoints
                ? task.story_points
                  ? `${task.story_points} pts`
                  : "No estimate"
              : "Disabled"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <CalendarClock className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-sm text-slate-500">Target Date</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {task.due_date ? formatDate(task.due_date) : "No date"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <UserRound className="mb-3 h-5 w-5 text-violet-300" />
            <p className="text-sm text-slate-500">Assignee</p>
            <p className="mt-1 truncate text-lg font-semibold text-white">
              {assigneeName}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <main className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-blue-400" />
                Issue Definition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={task.title}
                  onChange={(event) => patchLocalTask({ title: event.target.value })}
                  className="h-12 border-slate-700 bg-slate-950 text-base font-semibold text-white"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={task.description || ""}
                  onChange={(event) =>
                    patchLocalTask({ description: event.target.value })
                  }
                  className="min-h-[260px] resize-y border-slate-700 bg-slate-950 leading-6 text-slate-100"
                  placeholder="User story, acceptance criteria, technical notes..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="flex flex-col gap-3 border-b border-slate-800/80 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Subtasks
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Checklist progress for this issue.
                </p>
              </div>
              <Badge className="bg-slate-800 text-slate-300">
                {completedSubtasks}/{task.subtasks.length} done
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-2">
                <Progress
                  value={subtaskProgress}
                  className="h-2 bg-slate-800 [&>div]:bg-emerald-500"
                />
                <p className="text-xs text-slate-500">
                  {subtaskProgress}% complete
                </p>
              </div>

              <div className="space-y-2">
                {task.subtasks.map((subtask) => (
                  <button
                    key={subtask.id}
                    onClick={() =>
                      handleToggleSubtask(subtask.id, subtask.is_done)
                    }
                    className="flex w-full items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 text-left transition hover:border-blue-500/30 hover:bg-slate-950"
                  >
                    {subtask.is_done ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <span
                        className={
                          subtask.is_done
                            ? "text-slate-500 line-through"
                            : "text-slate-200"
                        }
                      >
                        {subtask.title}
                      </span>
                      <p className="mt-1 text-xs text-slate-600">
                        Added by {subtask.created_by_name || "Unknown user"}
                      </p>
                    </div>
                  </button>
                ))}

                {task.subtasks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-400">
                      No subtasks yet
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Break the issue into implementation steps.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newSubtaskTitle}
                  onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && handleAddSubtask()
                  }
                  placeholder="Add a subtask..."
                  className="h-11 border-slate-700 bg-slate-950"
                />
                <Button onClick={handleAddSubtask} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-cyan-300" />
                Comments
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="space-y-3">
                {task.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <Avatar className="h-9 w-9 border border-slate-700">
                        <AvatarFallback className="bg-blue-500/10 text-[10px] text-blue-200">
                          {getInitials(comment.author_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-100">
                          {comment.author_name || "Unknown user"}
                        </p>
                        <p className="text-xs text-slate-600">
                          {formatDate(comment.created_at)}
                          {comment.updated_at &&
                          comment.updated_at !== comment.created_at
                            ? " · edited"
                            : ""}
                        </p>
                      </div>
                      {currentUser?.id === comment.author_id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-500 hover:bg-slate-900 hover:text-white"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-slate-800 bg-slate-950 text-slate-200"
                          >
                            <DropdownMenuItem
                              className="cursor-pointer hover:bg-slate-900"
                              onClick={() =>
                                handleStartEditComment(comment.id, comment.body)
                              }
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer"
                              onClick={() => setCommentToDelete(comment.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>

                    {editingCommentId === comment.id ? (
                      <div className="space-y-3">
                        <Textarea
                          value={editingCommentBody}
                          onChange={(event) =>
                            setEditingCommentBody(event.target.value)
                          }
                          className="min-h-24 border-slate-700 bg-slate-900"
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                            onClick={() => {
                              setEditingCommentId(null);
                              setEditingCommentBody("");
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleSaveCommentEdit}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {comment.body}
                      </p>
                    )}
                  </div>
                ))}

                {task.comments.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
                    <p className="text-sm font-medium text-slate-400">
                      No comments yet
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Start the discussion on this issue.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Textarea
                  value={newComment}
                  onChange={(event) => setNewComment(event.target.value)}
                  placeholder="Add a comment..."
                  className="min-h-28 border-slate-700 bg-slate-950"
                />
                <Button
                  onClick={handleAddComment}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Add comment
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:self-start xl:overflow-y-auto xl:pr-1">
          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="text-base">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={task.status}
                  onValueChange={(value) =>
                    patchLocalTask({ status: value as TaskStatus })
                  }
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusLabels[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={task.priority}
                  onValueChange={(value) =>
                    patchLocalTask({ priority: value as TaskPriority })
                  }
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {priority}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {supportsStoryPoints ? (
                <div className="space-y-2">
                  <Label>Story Points</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={task.story_points ?? ""}
                    onChange={(event) =>
                      patchLocalTask({
                        story_points: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    className="h-11 border-slate-700 bg-slate-950"
                  />
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm font-medium text-slate-300">
                    Story Points disabled
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Kanban work is tracked by flow, not sprint estimation.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Target Date</Label>
                <Input
                  type="date"
                  value={toDateInputValue(task.due_date)}
                  onChange={(event) =>
                    patchLocalTask({
                      due_date: event.target.value
                        ? `${event.target.value}T23:59:00`
                        : null,
                    })
                  }
                  className="h-11 border-slate-700 bg-slate-950"
                />
              </div>

              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={task.assignee_id ? String(task.assignee_id) : "unassigned"}
                  onValueChange={handleAssigneeChange}
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem
                        key={member.membership_id}
                        value={String(member.user.id)}
                      >
                        {member.user.full_name || member.user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-5 w-5 text-violet-300" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {[...task.audit_logs].reverse().map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 border border-slate-700">
                      <AvatarFallback className="bg-violet-500/10 text-[10px] text-violet-200">
                        {getInitials(log.actor_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-200">
                        {actionLabel(log.action)}
                      </p>
                      <p className="text-xs text-slate-500">
                        by {log.actor_name || "System"} · {formatDate(log.created_at)}
                      </p>
                      {log.field && (
                        <p className="mt-3 break-words rounded-xl bg-slate-900 px-3 py-2 text-xs text-slate-400">
                          {log.field}:{" "}
                          <span className="text-rose-300">
                            {log.old_value || "-"}
                          </span>
                          {" -> "}
                          <span className="text-emerald-300">
                            {log.new_value || "-"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {task.audit_logs.length === 0 && (
                <p className="text-sm text-slate-500">No audit events yet.</p>
              )}
            </CardContent>
          </Card>

          <Button
            variant="outline"
            className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
            asChild
          >
            <Link href="/dashboard/board">
              Open on board
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </aside>
      </div>

      <ConfirmDialog
        open={commentToDelete !== null}
        onOpenChange={(open) => !open && setCommentToDelete(null)}
        title="Delete comment?"
        description="This removes the comment from the issue discussion. The audit trail will still record the action."
        confirmLabel="Delete Comment"
        destructive
        loading={deletingComment}
        onConfirm={handleDeleteComment}
      />
    </div>
  );
}
