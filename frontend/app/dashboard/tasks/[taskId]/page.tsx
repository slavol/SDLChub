"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { AuditLogEvent } from "@/components/dashboard/audit-log-event";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { sendRealtimeMessage, useRealtimeEvent } from "@/hooks/use-realtime-event";
import { formatAiSource, isAiFallback } from "@/lib/ai-source";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  getProjectDetail,
  getProjectMembers,
  getProjectTeams,
  Project,
  ProjectMember,
  ProjectTeam,
} from "@/services/project";
import {
  createSubtask,
  createTaskComment,
  deleteSubtask,
  deleteTask,
  deleteTaskComment,
  getTaskDetail,
  estimateTaskStoryPoints,
  invalidateTaskEstimate,
  refineTaskSpec,
  RefinedTaskSpec,
  TaskComment,
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

type TypingUser = {
  user_id: number;
  full_name?: string | null;
  avatar_url?: string | null;
  last_seen: number;
};

const COMMENT_TYPING_TTL_MS = 4500;
const COMMENT_TYPING_THROTTLE_MS = 1200;
const COMMENT_TYPING_STOP_DELAY_MS = 1800;

const SDLC_CHECKLIST = [
  "Planificare - clarificare scop si dependinte",
  "Analiza - definire user story si criterii de acceptare",
  "Design - propunere solutie tehnica si impact UI/API",
  "Implementare - dezvoltare functionalitate",
  "Integrare - conectare cu modulele existente",
  "Testare - validare functionalitate si regresii",
];

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

export default function TaskDetailPage() {
  const params = useParams<{ taskId: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();
  const taskId = Number(params.taskId);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [project, setProject] = useState<Project | null>(currentProject);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [subtaskToDelete, setSubtaskToDelete] = useState<number | null>(null);
  const [deletingSubtask, setDeletingSubtask] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingStopTimerRef = useRef<number | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const [deleteTaskOpen, setDeleteTaskOpen] = useState(false);
  const [deleteTaskReason, setDeleteTaskReason] = useState("");
  const [deleteTaskConfirmKey, setDeleteTaskConfirmKey] = useState("");
  const [deletingTask, setDeletingTask] = useState(false);
  const [invalidateEstimateOpen, setInvalidateEstimateOpen] = useState(false);
  const [invalidateEstimateReason, setInvalidateEstimateReason] = useState("");
  const [invalidatingEstimate, setInvalidatingEstimate] = useState(false);
  const [aiWorking, setAiWorking] = useState(false);
  const [aiSuggestedSubtasks, setAiSuggestedSubtasks] = useState<string[]>([]);
  const [lastRefinedSpec, setLastRefinedSpec] = useState<RefinedTaskSpec | null>(null);
  const [aiStatusMessage, setAiStatusMessage] = useState<{
    tone: "success" | "fallback";
    title: string;
    detail: string;
    source?: string;
  } | null>(null);

  const supportsStoryPoints = project?.methodology !== "KANBAN";
  const { can } = useProjectPermissions(task?.project_id || project?.id || currentProject?.id);
  const canUpdateTask = can("TASK_UPDATE");
  const canAssignTask = can("TASK_ASSIGN");
  const canMoveTask = can("TASK_MOVE");
  const canComment = can("TASK_COMMENT");
  const canDeleteTask = can("TASK_DELETE");
  const canUseAi = can("AI_USE");
  const canSaveTask = canUpdateTask || canAssignTask || canMoveTask;

  const completedSubtasks = useMemo(
    () => task?.subtasks.filter((subtask) => subtask.is_done).length || 0,
    [task?.subtasks]
  );

  const subtaskProgress = task?.subtasks.length
    ? Math.round((completedSubtasks / task.subtasks.length) * 100)
    : 0;

  const assigneeName = task?.assignee_name || "Unassigned";

  const loadTask = useCallback(async (showLoader = true) => {
    if (!taskId) return;

    if (showLoader) setLoading(true);
    try {
      const data = await getTaskDetail(taskId);
      setTask(data);

      const [projectMembers, projectTeams, detailProject] = await Promise.all([
        getProjectMembers(data.project_id).catch(() => []),
        getProjectTeams(data.project_id).catch(() => []),
        currentProject?.id === data.project_id
          ? Promise.resolve(currentProject)
          : getProjectDetail(data.project_id).catch(() => null),
      ]);

      setMembers(projectMembers);
      setTeams(projectTeams);

      if (detailProject) {
        setProject(detailProject);

        if (currentProject?.id !== detailProject.id) {
          setCurrentProject(detailProject);
        }
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load task."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentProject, setCurrentProject, taskId]);

  useEffect(() => {
    loadTask();
  }, [loadTask]);

  useRealtimeEvent((message) => {
    const changedTaskId = Number(message.payload?.task_id || 0);

    if (message.project_id && task?.project_id && message.project_id !== task.project_id) {
      return;
    }

    if (message.type === "comment.created" && changedTaskId === taskId) {
      const incomingComment = message.payload?.comment as TaskComment | undefined;
      if (!incomingComment?.id) return;

      setTask((current) => {
        if (!current) return current;

        const exists = current.comments.some((comment) => comment.id === incomingComment.id);
        return {
          ...current,
          comments: exists
            ? current.comments.map((comment) =>
                comment.id === incomingComment.id ? incomingComment : comment
              )
            : [...current.comments, incomingComment],
        };
      });
      return;
    }

    if (message.type === "comment.updated" && changedTaskId === taskId) {
      const incomingComment = message.payload?.comment as TaskComment | undefined;
      if (!incomingComment?.id) return;

      setTask((current) =>
        current
          ? {
              ...current,
              comments: current.comments.map((comment) =>
                comment.id === incomingComment.id ? incomingComment : comment
              ),
            }
          : current
      );
      return;
    }

    if (message.type === "comment.deleted" && changedTaskId === taskId) {
      const deletedCommentId = Number(message.payload?.comment_id || 0);
      if (!deletedCommentId) return;

      setTask((current) =>
        current
          ? {
              ...current,
              comments: current.comments.filter((comment) => comment.id !== deletedCommentId),
            }
          : current
      );

      if (editingCommentId === deletedCommentId) {
        setEditingCommentId(null);
        setEditingCommentBody("");
      }
      if (commentToDelete === deletedCommentId) {
        setCommentToDelete(null);
      }
      return;
    }

    if (message.type === "comment.typing" && changedTaskId === taskId) {
      const typingUserId = Number(message.payload?.user_id || 0);
      if (!typingUserId || typingUserId === currentUser?.id) return;

      const isTyping = Boolean(message.payload?.is_typing);
      setTypingUsers((current) => {
        const remaining = current.filter((user) => user.user_id !== typingUserId);
        if (!isTyping) return remaining;

        return [
          ...remaining,
          {
            user_id: typingUserId,
            full_name:
              typeof message.payload?.full_name === "string"
                ? message.payload.full_name
                : "A teammate",
            avatar_url:
              typeof message.payload?.avatar_url === "string"
                ? message.payload.avatar_url
                : null,
            last_seen: Date.now(),
          },
        ];
      });
      return;
    }

    if (message.type === "task.changed" && changedTaskId === taskId) {
      const action = String(message.payload?.action || "");
      if (action.startsWith("comment_")) return;
      loadTask(false);
    }

    if (message.type === "user.updated" && task?.project_id && message.project_id === task.project_id) {
      loadTask(false);
    }
  }, [commentToDelete, currentUser?.id, editingCommentId, loadTask, task?.project_id, taskId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const cutoff = Date.now() - COMMENT_TYPING_TTL_MS;
      setTypingUsers((current) => current.filter((user) => user.last_seen >= cutoff));
    }, 1200);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) {
        window.clearTimeout(typingStopTimerRef.current);
      }
    };
  }, []);

  const patchLocalTask = (updates: Partial<TaskDetail>) => {
    setTask((current) => (current ? { ...current, ...updates } : current));
  };

  const patchLocalComment = (comment: TaskComment) => {
    setTask((current) => {
      if (!current) return current;

      const exists = current.comments.some((item) => item.id === comment.id);
      return {
        ...current,
        comments: exists
          ? current.comments.map((item) => (item.id === comment.id ? comment : item))
          : [...current.comments, comment],
      };
    });
  };

  const removeLocalComment = (commentId: number) => {
    setTask((current) =>
      current
        ? {
            ...current,
            comments: current.comments.filter((comment) => comment.id !== commentId),
          }
        : current
    );
  };

  const sendCommentTyping = (isTyping: boolean) => {
    if (!task || !canComment) return;

    sendRealtimeMessage({
      type: "comment.typing",
      project_id: task.project_id,
      payload: {
        task_id: task.id,
        is_typing: isTyping,
      },
    });
  };

  const handleCommentDraftChange = (value: string) => {
    setNewComment(value);

    if (!task || !canComment) return;

    const now = Date.now();
    if (now - lastTypingSentAtRef.current > COMMENT_TYPING_THROTTLE_MS) {
      lastTypingSentAtRef.current = now;
      sendCommentTyping(value.trim().length > 0);
    }

    if (typingStopTimerRef.current) {
      window.clearTimeout(typingStopTimerRef.current);
    }

    typingStopTimerRef.current = window.setTimeout(() => {
      sendCommentTyping(false);
    }, COMMENT_TYPING_STOP_DELAY_MS);
  };

  const handleSave = async () => {
    if (!canSaveTask) return;
    if (!task) return;

    setSaving(true);
    try {
      const payload = {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        assignee_id: task.assignee_id || 0,
        team_id: task.team_id || 0,
        due_date: task.due_date,
        ...(supportsStoryPoints ? { story_points: task.story_points } : {}),
      };

      const updated = await updateTask(task.id, payload);
      patchLocalTask(updated);
      await loadTask(false);
      toast.success("Task saved");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save task."));
    } finally {
      setSaving(false);
    }
  };

  const handleRefineWithAi = async () => {
    if (!task || !canUseAi || !canUpdateTask) return;

    setAiWorking(true);
    try {
      const refined = await refineTaskSpec(
        task.title,
        task.description || "",
        task.priority,
        task.project_id
      );

      const updated = await updateTask(task.id, {
        description: refined.markdown,
      });

      patchLocalTask(updated);
      setLastRefinedSpec(refined);
      setAiSuggestedSubtasks(refined.suggested_subtasks || []);
      setAiStatusMessage({
        tone: isAiFallback(refined.source) ? "fallback" : "success",
        title: isAiFallback(refined.source)
          ? "Spec saved with local fallback"
          : "Spec refined and saved",
        detail: isAiFallback(refined.source)
          ? "Gemini was unavailable or returned an invalid response, so SDLC Hub used a structured local template."
          : "The issue description was updated in the audit trail and synced to the team.",
        source: refined.source,
      });
      await loadTask(false);
      toast.success(
        isAiFallback(refined.source)
          ? "Spec saved with local fallback."
          : "AI refined and saved the issue definition."
      );
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not refine this task."));
    } finally {
      setAiWorking(false);
    }
  };

  const handleEstimateWithAi = async () => {
    if (!task || !supportsStoryPoints || !canUseAi || !canUpdateTask) return;

    setAiWorking(true);
    try {
      const estimate = await estimateTaskStoryPoints(
        task.title,
        task.description || "",
        task.priority,
        task.project_id
      );

      const updated = await updateTask(task.id, {
        story_points: estimate.story_points,
      });
      patchLocalTask(updated);
      await loadTask(false);
      toast.success(`AI estimate: ${estimate.story_points} story points`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not estimate story points."));
    } finally {
      setAiWorking(false);
    }
  };

  const handleInvalidateEstimate = async () => {
    if (!task || !supportsStoryPoints || !canUpdateTask) return;
    if (invalidateEstimateReason.trim().length < 8) {
      toast.error("Please add a reason with at least 8 characters.");
      return;
    }

    setInvalidatingEstimate(true);
    try {
      const updated = await invalidateTaskEstimate(task.id, invalidateEstimateReason.trim());
      patchLocalTask(updated);
      setInvalidateEstimateOpen(false);
      setInvalidateEstimateReason("");
      await loadTask(false);
      toast.success("Estimate invalidated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not invalidate estimate."));
    } finally {
      setInvalidatingEstimate(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!task || !canDeleteTask) return;
    if (deleteTaskReason.trim().length < 8) {
      toast.error("Please add a deletion reason with at least 8 characters.");
      return;
    }

    setDeletingTask(true);
    try {
      await deleteTask(task.id, {
        reason: deleteTaskReason.trim(),
        confirm_key: deleteTaskConfirmKey.trim(),
      });
      toast.success(`${task.key} deleted`);
      router.push("/dashboard/tasks");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete task."));
    } finally {
      setDeletingTask(false);
    }
  };

  const handleApplyAiSubtasks = async () => {
    if (!task || !canUpdateTask || aiSuggestedSubtasks.length === 0) return;

    setAiWorking(true);
    try {
      const existingTitles = new Set(
        task.subtasks.map((subtask) => subtask.title.trim().toLowerCase())
      );
      const nextSubtasks = aiSuggestedSubtasks
        .map((subtask) => subtask.trim())
        .filter((subtask) => subtask && !existingTitles.has(subtask.toLowerCase()))
        .slice(0, 12);

      if (nextSubtasks.length === 0) {
        setAiSuggestedSubtasks([]);
        toast.info("AI checklist already exists on this task.");
        return;
      }

      await Promise.all(nextSubtasks.map((subtask) => createSubtask(task.id, subtask)));
      setAiSuggestedSubtasks([]);
      await loadTask(false);
      toast.success(`${nextSubtasks.length} AI subtasks added`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add AI subtasks."));
    } finally {
      setAiWorking(false);
    }
  };

  const handleApplySdlcChecklist = async () => {
    if (!task || !canUpdateTask) return;

    setAiWorking(true);
    try {
      const existingTitles = new Set(
        task.subtasks.map((subtask) => subtask.title.trim().toLowerCase())
      );
      const nextSubtasks = SDLC_CHECKLIST.filter(
        (subtask) => !existingTitles.has(subtask.toLowerCase())
      );

      if (nextSubtasks.length === 0) {
        toast.info("SDLC checklist already exists on this task.");
        return;
      }

      await Promise.all(nextSubtasks.map((subtask) => createSubtask(task.id, subtask)));
      await loadTask(false);
      toast.success(`${nextSubtasks.length} SDLC subtasks added`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add SDLC subtasks."));
    } finally {
      setAiWorking(false);
    }
  };

  const handleAssigneeChange = (value: string) => {
    if (!canAssignTask) return;

    const assigneeId = value === "unassigned" ? undefined : Number(value);
    const member = members.find((item) => item.user.id === assigneeId);

    patchLocalTask({
      assignee_id: assigneeId,
      assignee_name: member?.user.full_name || null,
    });
  };

  const handleTeamChange = (value: string) => {
    if (!canAssignTask) return;

    const teamId = value === "none" ? undefined : Number(value);
    const team = teams.find((item) => item.id === teamId);

    patchLocalTask({
      team_id: teamId,
      team_name: team?.name || null,
    });
  };

  const handleAddSubtask = async () => {
    if (!canUpdateTask) return;
    if (!task || !newSubtaskTitle.trim()) return;

    try {
      await createSubtask(task.id, newSubtaskTitle.trim());
      setNewSubtaskTitle("");
      await loadTask(false);
      toast.success("Subtask added");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add subtask."));
    }
  };

  const handleStartEditSubtask = (subtaskId: number, title: string) => {
    if (!canUpdateTask) return;
    setEditingSubtaskId(subtaskId);
    setEditingSubtaskTitle(title);
  };

  const handleSaveSubtaskEdit = async () => {
    if (!canUpdateTask) return;
    if (!task || !editingSubtaskId || !editingSubtaskTitle.trim()) return;

    try {
      await updateSubtask(task.id, editingSubtaskId, { title: editingSubtaskTitle.trim() });
      setEditingSubtaskId(null);
      setEditingSubtaskTitle("");
      await loadTask(false);
      toast.success("Subtask updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update subtask."));
    }
  };

  const handleDeleteSubtask = async () => {
    if (!canUpdateTask) return;
    if (!task || !subtaskToDelete) return;

    setDeletingSubtask(true);
    try {
      await deleteSubtask(task.id, subtaskToDelete);
      setSubtaskToDelete(null);
      await loadTask(false);
      toast.success("Subtask deleted");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete subtask."));
    } finally {
      setDeletingSubtask(false);
    }
  };

  const handleToggleSubtask = async (subtaskId: number, isDone: boolean) => {
    if (!canUpdateTask) return;
    if (!task) return;

    try {
      await updateSubtask(task.id, subtaskId, { is_done: !isDone });
      await loadTask(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update subtask."));
    }
  };

  const handleAddComment = async () => {
    if (!canComment) return;
    if (!task || !newComment.trim()) return;

    try {
      const createdComment = await createTaskComment(task.id, newComment.trim());
      patchLocalComment(createdComment);
      setNewComment("");
      sendCommentTyping(false);
      toast.success("Comment added");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not add comment."));
    }
  };

  const handleStartEditComment = (commentId: number, body: string) => {
    if (!canComment) return;

    setEditingCommentId(commentId);
    setEditingCommentBody(body);
  };

  const handleSaveCommentEdit = async () => {
    if (!canComment) return;
    if (!task || !editingCommentId || !editingCommentBody.trim()) return;

    try {
      const updatedComment = await updateTaskComment(task.id, editingCommentId, editingCommentBody.trim());
      patchLocalComment(updatedComment);
      setEditingCommentId(null);
      setEditingCommentBody("");
      toast.success("Comment updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update comment."));
    }
  };

  const handleDeleteComment = async () => {
    if (!canComment) return;
    if (!task) return;
    if (!commentToDelete) return;

    setDeletingComment(true);
    try {
      const deletedCommentId = commentToDelete;
      await deleteTaskComment(task.id, deletedCommentId);
      removeLocalComment(deletedCommentId);
      setCommentToDelete(null);
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
    <div className="mx-auto w-full max-w-[1500px] space-y-7 px-4 py-5 text-slate-50 sm:px-5 md:p-7 xl:p-8">
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
                {task.team_name && (
                  <Badge
                    variant="outline"
                    className="border-cyan-500/25 bg-cyan-500/10 text-cyan-200"
                  >
                    {task.team_name}
                  </Badge>
                )}
              </div>

              <h1 className="break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                {task.title}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Created {formatDate(task.created_at)} · {completedSubtasks}/
                {task.subtasks.length} subtasks complete
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:shrink-0">
              <Button
                onClick={handleSave}
                disabled={saving || !canSaveTask}
                className="h-11 w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save changes
              </Button>
              {canUseAi && canUpdateTask && (
                <Button
                  variant="outline"
                  onClick={handleRefineWithAi}
                  disabled={aiWorking}
                  className="h-11 w-full border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900 sm:w-auto"
                >
                  {aiWorking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Refine & save
                </Button>
              )}
              {canDeleteTask && (
                <Button
                  variant="outline"
                  onClick={() => setDeleteTaskOpen(true)}
                  className="h-11 w-full border-rose-500/30 bg-rose-950/20 text-rose-200 hover:bg-rose-950/40 hover:text-rose-100 sm:w-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <ClipboardList className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Status</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {statusLabels[task.status]}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <Flag className="mb-3 h-5 w-5 text-orange-300" />
            <p className="text-sm text-slate-500">Priority</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {task.priority}
            </p>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
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
          <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <CalendarClock className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-sm text-slate-500">Target Date</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {task.due_date ? formatDate(task.due_date) : "No date"}
            </p>
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
              <p className="truncate text-lg font-semibold text-white">
                {assigneeName}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-6">
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
                      onClick={handleRefineWithAi}
                      disabled={aiWorking}
                      className="inline-flex items-center text-xs text-emerald-400 transition hover:text-emerald-300 disabled:opacity-50"
                    >
                      {aiWorking ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3" />
                      )}
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

          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="flex flex-col gap-3 border-b border-slate-800/80 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Subtasks
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Checklist progress for this issue.
                </p>
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Badge className="bg-slate-800 text-slate-300">
                  {completedSubtasks}/{task.subtasks.length} done
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleApplySdlcChecklist}
                  disabled={!canUpdateTask || aiWorking}
                  className="w-full border-slate-700 bg-slate-950/70 text-slate-200 hover:bg-slate-900 sm:w-auto"
                >
                  {aiWorking ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  SDLC checklist
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-5">
              {aiSuggestedSubtasks.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-semibold text-emerald-100">
                        AI suggested subtasks
                      </p>
                      <p className="mt-1 text-xs text-emerald-100/70">
                        Apply these as real checklist items.
                        {lastRefinedSpec?.source ? ` Source: ${formatAiSource(lastRefinedSpec.source)}.` : ""}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleApplyAiSubtasks}
                      disabled={aiWorking || !canUpdateTask}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {aiWorking ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="mr-2 h-4 w-4" />
                      )}
                      Apply checklist
                    </Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {aiSuggestedSubtasks.slice(0, 8).map((subtask) => (
                      <div key={subtask} className="break-words rounded-xl border border-emerald-400/15 bg-slate-950/50 px-3 py-2 text-xs text-emerald-50/85">
                        {subtask}
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  <div
                    key={subtask.id}
                    className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 transition hover:border-blue-500/30 hover:bg-slate-950"
                  >
                    {editingSubtaskId === subtask.id ? (
                      <div className="space-y-3">
                        <Input
                          value={editingSubtaskTitle}
                          onChange={(event) => setEditingSubtaskTitle(event.target.value)}
                          disabled={!canUpdateTask}
                          className="h-11 border-slate-700 bg-slate-900"
                        />
                        <div className="flex flex-col justify-end gap-2 sm:flex-row">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                            onClick={() => {
                              setEditingSubtaskId(null);
                              setEditingSubtaskTitle("");
                            }}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700"
                            onClick={handleSaveSubtaskEdit}
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
                          onClick={() => handleToggleSubtask(subtask.id, subtask.is_done)}
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
                            onClick={() => handleToggleSubtask(subtask.id, subtask.is_done)}
                            disabled={!canUpdateTask}
                            className="block w-full text-left disabled:cursor-not-allowed"
                          >
                            <span
                              className={
                                subtask.is_done
                                  ? "text-slate-500 line-through"
                                  : "text-slate-200"
                              }
                            >
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
                                onClick={() => handleStartEditSubtask(subtask.id, subtask.title)}
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => setSubtaskToDelete(subtask.id)}
                              >
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={newSubtaskTitle}
                  onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  onKeyDown={(event) =>
                    event.key === "Enter" && handleAddSubtask()
                  }
                  placeholder="Add a subtask..."
                  disabled={!canUpdateTask}
                  className="h-11 border-slate-700 bg-slate-950"
                />
                <Button onClick={handleAddSubtask} disabled={!canUpdateTask} className="w-full bg-blue-600 hover:bg-blue-700 sm:w-11">
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
            <CardContent className="space-y-5 p-4 sm:p-5">
              <div className="space-y-3">
                {task.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/75 p-4"
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <UserAvatar
                        name={comment.author_name}
                        src={comment.author_avatar_url}
                        className="h-9 w-9"
                        fallbackClassName="bg-blue-500/10 text-[10px] text-blue-200"
                      />
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
                      {currentUser?.id === comment.author_id && canComment && (
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
                          disabled={!canComment}
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
                            disabled={!canComment}
                          >
                            <Save className="mr-2 h-4 w-4" />
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                        {comment.body}
                      </p>
                    )}
                  </div>
                ))}

                {typingUsers.length > 0 && (
                  <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
                    <div className="flex -space-x-2">
                      {typingUsers.slice(0, 3).map((user) => (
                        <UserAvatar
                          key={user.user_id}
                          name={user.full_name}
                          src={user.avatar_url}
                          className="h-7 w-7 border border-slate-950"
                          fallbackClassName="bg-cyan-500/10 text-[10px] text-cyan-100"
                        />
                      ))}
                    </div>
                    <span>
                      {typingUsers.length === 1
                        ? `${typingUsers[0].full_name || "A teammate"} is typing...`
                        : `${typingUsers.length} teammates are typing...`}
                    </span>
                  </div>
                )}

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
                  onChange={(event) => handleCommentDraftChange(event.target.value)}
                  onBlur={() => sendCommentTyping(false)}
                  placeholder="Add a comment..."
                  disabled={!canComment}
                  className="min-h-28 border-slate-700 bg-slate-950"
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!canComment}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Add comment
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-violet-300" />
                Audit Log
              </CardTitle>
              <p className="text-sm text-slate-500">
                Immutable activity trail for this issue.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-4 sm:p-5">
              {[...task.audit_logs].reverse().map((log) => (
                <AuditLogEvent key={log.id} event={log} />
              ))}

              {task.audit_logs.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
                  <p className="text-sm font-medium text-slate-400">
                    No audit events yet
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Changes will appear here as the issue evolves.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <aside className="xl:self-start">
          <div className="space-y-4 xl:sticky xl:top-6">
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
                    disabled={!canMoveTask}
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
                  disabled={!canUpdateTask}
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
                  <div className="flex items-center justify-between gap-3">
                    <Label>Story Points</Label>
                    {canUseAi && canUpdateTask && (
                      <button
                        type="button"
                        onClick={handleEstimateWithAi}
                        disabled={aiWorking}
                        className="inline-flex items-center text-xs text-blue-300 transition hover:text-blue-200 disabled:opacity-50"
                      >
                        {aiWorking ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1 h-3 w-3" />
                        )}
                        Estimate
                      </button>
                    )}
                  </div>
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
                    disabled={!canUpdateTask}
                    className="h-11 border-slate-700 bg-slate-950"
                  />
                  {canUpdateTask && task.story_points !== null && task.story_points !== undefined && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInvalidateEstimateOpen(true)}
                      className="h-10 w-full border-amber-500/25 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                    >
                      <Gauge className="mr-2 h-4 w-4" />
                      Invalidate estimate
                    </Button>
                  )}
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
                  disabled={!canUpdateTask}
                  className="h-11 border-slate-700 bg-slate-950"
                />
              </div>

              <div className="space-y-2">
                <Label>Assignee</Label>
                <Select
                  value={task.assignee_id ? String(task.assignee_id) : "unassigned"}
                  onValueChange={handleAssigneeChange}
                  disabled={!canAssignTask}
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
                <Label>Delivery Team</Label>
                <Select
                  value={task.team_id ? String(task.team_id) : "none"}
                  onValueChange={handleTeamChange}
                  disabled={!canAssignTask}
                >
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue placeholder="No team" />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="none">No team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={String(team.id)}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
          </div>
        </aside>
      </div>

      <Dialog
        open={invalidateEstimateOpen}
        onOpenChange={(open) => {
          setInvalidateEstimateOpen(open);
          if (!open) setInvalidateEstimateReason("");
        }}
      >
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
              onChange={(event) => setInvalidateEstimateReason(event.target.value)}
              placeholder="Example: scope changed after API review, previous estimate is no longer valid."
              className="min-h-28 border-slate-700 bg-slate-900"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="text-slate-400 hover:text-white"
              disabled={invalidatingEstimate}
              onClick={() => setInvalidateEstimateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={invalidatingEstimate || invalidateEstimateReason.trim().length < 8}
              onClick={handleInvalidateEstimate}
            >
              {invalidatingEstimate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Invalidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTaskOpen}
        onOpenChange={(open) => {
          setDeleteTaskOpen(open);
          if (!open) {
            setDeleteTaskReason("");
            setDeleteTaskConfirmKey("");
          }
        }}
      >
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
                onChange={(event) => setDeleteTaskReason(event.target.value)}
                placeholder="Explain why this task is being deleted."
                className="min-h-28 border-slate-700 bg-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmation key</Label>
              <Input
                value={deleteTaskConfirmKey}
                onChange={(event) => setDeleteTaskConfirmKey(event.target.value)}
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
              onClick={() => setDeleteTaskOpen(false)}
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
              onClick={handleDeleteTask}
            >
              {deletingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={subtaskToDelete !== null}
        onOpenChange={(open) => !open && setSubtaskToDelete(null)}
        title="Delete subtask?"
        description="This removes the checklist item from the issue. The task audit trail will keep the deletion event."
        confirmLabel="Delete Subtask"
        destructive
        loading={deletingSubtask}
        onConfirm={handleDeleteSubtask}
      />

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
