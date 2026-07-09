"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { sendRealtimeMessage, useRealtimeEvent } from "@/hooks/use-realtime-event";
import { isAiFallback } from "@/lib/ai-source";
import { getApiErrorMessage } from "@/lib/api-error";
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
  updateSubtask,
  updateTask,
  updateTaskComment,
} from "@/services/task";
import { getTaskGitHubEvents, GitHubEventItem } from "@/services/github";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";
import { IssueDefinitionCard, type IssueAiStatusMessage } from "./issue-definition-card";
import { TaskCommentsCard } from "./task-comments-card";
import { DevelopmentLinksCard } from "./development-links-card";
import { TaskAuditLogCard } from "./task-audit-log-card";
import { TaskDetailHeader } from "./task-detail-header";
import { TaskDetailMetrics } from "./task-detail-metrics";
import { TaskDetailSkeleton } from "./task-detail-skeleton";
import { TaskGovernanceDialogs } from "./task-governance-dialogs";
import { TaskPropertiesPanel } from "./task-properties-panel";
import { TaskSubtasksCard } from "./task-subtasks-card";
import {
  COMMENT_TYPING_STOP_DELAY_MS,
  COMMENT_TYPING_THROTTLE_MS,
  COMMENT_TYPING_TTL_MS,
  TypingUser,
  filterTaskGitHubEvents,
} from "./task-detail-utils";

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
  const [githubEvents, setGithubEvents] = useState<GitHubEventItem[]>([]);
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
  const [aiStatusMessage, setAiStatusMessage] = useState<IssueAiStatusMessage | null>(null);

  const supportsStoryPoints = project?.methodology !== "KANBAN";
  const { can } = useProjectPermissions(task?.project_id || project?.id || currentProject?.id);

  // Permisiunile controleaza simultan afisarea butoanelor si protectia din
  // handler-ele API, astfel incat UI-ul si backend-ul raman aliniate.
  const canUpdateTask = can("TASK_UPDATE");
  const canAssignTask = can("TASK_ASSIGN");
  const canMoveTask = can("TASK_MOVE");
  const canComment = can("TASK_COMMENT");
  const canDeleteTask = can("TASK_DELETE");
  const canUseAi = can("AI_USE");
  const canSaveTask = canUpdateTask || canAssignTask || canMoveTask;

  // Valorile derivate raman in pagina-container, iar componentele extrase
  // primesc doar date gata de afisat.
  const completedSubtasks = useMemo(
    () => task?.subtasks.filter((subtask) => subtask.is_done).length || 0,
    [task?.subtasks]
  );

  const subtaskProgress = task?.subtasks.length
    ? Math.round((completedSubtasks / task.subtasks.length) * 100)
    : 0;

  const assigneeName = task?.assignee_name || "Unassigned";

  // Incarcarea principala strange task-ul si datele auxiliare necesare paginii:
  // membri, echipe, proiect curent si evenimente GitHub legate de task.
  const loadTask = useCallback(async (showLoader = true) => {
    if (!taskId) return;

    if (showLoader) setLoading(true);
    try {
      const data = await getTaskDetail(taskId);
      setTask(data);

      const [projectMembers, projectTeams, detailProject, taskGithubEvents] = await Promise.all([
        getProjectMembers(data.project_id).catch(() => []),
        getProjectTeams(data.project_id).catch(() => []),
        currentProject?.id === data.project_id
          ? Promise.resolve(currentProject)
          : getProjectDetail(data.project_id).catch(() => null),
        getTaskGitHubEvents(data.id, 120).catch(() => []),
      ]);

      setMembers(projectMembers);
      setTeams(projectTeams);
      setGithubEvents(filterTaskGitHubEvents(taskGithubEvents, data));

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

    // Comentariile sunt sincronizate incremental prin websocket ca sa nu refacem
    // tot request-ul de task la fiecare mesaj nou.
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

    // Indicatorul de typing este tinut doar local si expira automat daca nu mai
    // primim semnale proaspete de la celalalt browser.
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

    // Limitam frecventa mesajelor de typing; altfel un input rapid ar trimite
    // un eveniment websocket la fiecare tasta.
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
          ? "The configured AI provider was unavailable or returned an invalid response, so SDLC Hub used a structured local template."
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
        toast.info("AI subtasks already exist on this task.");
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
    return <TaskDetailSkeleton />;
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
        <TaskDetailHeader
          task={task}
          project={project}
          completedSubtasks={completedSubtasks}
          canSaveTask={canSaveTask}
          canUseAi={canUseAi}
          canUpdateTask={canUpdateTask}
          canDeleteTask={canDeleteTask}
          saving={saving}
          aiWorking={aiWorking}
          onSave={handleSave}
          onRefineWithAi={handleRefineWithAi}
          onRequestDelete={() => setDeleteTaskOpen(true)}
        />
        <TaskDetailMetrics
          task={task}
          supportsStoryPoints={supportsStoryPoints}
          assigneeName={assigneeName}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-6">
          <IssueDefinitionCard
            task={task}
            canUseAi={canUseAi}
            canUpdateTask={canUpdateTask}
            aiWorking={aiWorking}
            aiStatusMessage={aiStatusMessage}
            patchLocalTask={patchLocalTask}
            onRefineWithAi={handleRefineWithAi}
          />

          <TaskSubtasksCard
            subtasks={task.subtasks}
            completedSubtasks={completedSubtasks}
            subtaskProgress={subtaskProgress}
            aiSuggestedSubtasks={aiSuggestedSubtasks}
            lastRefinedSpec={lastRefinedSpec}
            aiWorking={aiWorking}
            canUpdateTask={canUpdateTask}
            newSubtaskTitle={newSubtaskTitle}
            editingSubtaskId={editingSubtaskId}
            editingSubtaskTitle={editingSubtaskTitle}
            onNewSubtaskTitleChange={setNewSubtaskTitle}
            onEditingSubtaskTitleChange={setEditingSubtaskTitle}
            onCancelSubtaskEdit={() => {
              setEditingSubtaskId(null);
              setEditingSubtaskTitle("");
            }}
            onApplyAiSubtasks={handleApplyAiSubtasks}
            onAddSubtask={handleAddSubtask}
            onStartEditSubtask={handleStartEditSubtask}
            onSaveSubtaskEdit={handleSaveSubtaskEdit}
            onRequestDeleteSubtask={setSubtaskToDelete}
            onToggleSubtask={handleToggleSubtask}
          />

          <TaskCommentsCard
            comments={task.comments}
            currentUserId={currentUser?.id}
            canComment={canComment}
            typingUsers={typingUsers}
            newComment={newComment}
            editingCommentId={editingCommentId}
            editingCommentBody={editingCommentBody}
            onDraftChange={handleCommentDraftChange}
            onStopTyping={() => sendCommentTyping(false)}
            onAddComment={handleAddComment}
            onStartEditComment={handleStartEditComment}
            onEditingCommentBodyChange={setEditingCommentBody}
            onCancelCommentEdit={() => {
              setEditingCommentId(null);
              setEditingCommentBody("");
            }}
            onSaveCommentEdit={handleSaveCommentEdit}
            onRequestDeleteComment={setCommentToDelete}
          />

          <DevelopmentLinksCard events={githubEvents} taskKey={task.key} />

          <TaskAuditLogCard logs={task.audit_logs} />
        </main>

        <TaskPropertiesPanel
          task={task}
          members={members}
          teams={teams}
          supportsStoryPoints={supportsStoryPoints}
          canMoveTask={canMoveTask}
          canUpdateTask={canUpdateTask}
          canUseAi={canUseAi}
          canAssignTask={canAssignTask}
          aiWorking={aiWorking}
          patchLocalTask={patchLocalTask}
          onEstimateWithAi={handleEstimateWithAi}
          onInvalidateEstimate={() => setInvalidateEstimateOpen(true)}
          onAssigneeChange={handleAssigneeChange}
          onTeamChange={handleTeamChange}
        />
      </div>

      <TaskGovernanceDialogs
        task={task}
        invalidateEstimateOpen={invalidateEstimateOpen}
        deleteTaskOpen={deleteTaskOpen}
        subtaskDeleteOpen={subtaskToDelete !== null}
        commentDeleteOpen={commentToDelete !== null}
        invalidateEstimateReason={invalidateEstimateReason}
        deleteTaskReason={deleteTaskReason}
        deleteTaskConfirmKey={deleteTaskConfirmKey}
        invalidatingEstimate={invalidatingEstimate}
        deletingTask={deletingTask}
        deletingSubtask={deletingSubtask}
        deletingComment={deletingComment}
        onInvalidateEstimateOpenChange={(open) => {
          setInvalidateEstimateOpen(open);
          if (!open) setInvalidateEstimateReason("");
        }}
        onDeleteTaskOpenChange={(open) => {
          setDeleteTaskOpen(open);
          if (!open) {
            setDeleteTaskReason("");
            setDeleteTaskConfirmKey("");
          }
        }}
        onSubtaskDeleteOpenChange={(open) => !open && setSubtaskToDelete(null)}
        onCommentDeleteOpenChange={(open) => !open && setCommentToDelete(null)}
        onInvalidateEstimateReasonChange={setInvalidateEstimateReason}
        onDeleteTaskReasonChange={setDeleteTaskReason}
        onDeleteTaskConfirmKeyChange={setDeleteTaskConfirmKey}
        onConfirmInvalidateEstimate={handleInvalidateEstimate}
        onConfirmDeleteTask={handleDeleteTask}
        onConfirmDeleteSubtask={handleDeleteSubtask}
        onConfirmDeleteComment={handleDeleteComment}
      />
    </div>
  );
}
