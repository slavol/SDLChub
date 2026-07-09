import { GitHubEventItem } from "@/services/github";
import { TaskDetail, TaskPriority, TaskStatus } from "@/services/task";

export const priorityOptions = Object.values(TaskPriority);
export const statusOptions = Object.values(TaskStatus);

export type TypingUser = {
  user_id: number;
  full_name?: string | null;
  avatar_url?: string | null;
  last_seen: number;
};

// Valorile acestea controleaza doar prezenta indicatorului de typing in UI.
// Evenimentele realtime raman fire-and-forget, ca sa nu blocheze scrierea comentariilor.
export const COMMENT_TYPING_TTL_MS = 4500;
export const COMMENT_TYPING_THROTTLE_MS = 1200;
export const COMMENT_TYPING_STOP_DELAY_MS = 1800;

export const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.REVIEW]: "Review",
  [TaskStatus.DONE]: "Done",
};

export const statusClass: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskStatus.IN_PROGRESS]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskStatus.REVIEW]: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  [TaskStatus.DONE]: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

export const priorityClass: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskPriority.MEDIUM]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskPriority.HIGH]: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  [TaskPriority.CRITICAL]: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

export function githubEventTone(event: GitHubEventItem) {
  if (event.event_type === "pull_request") return "border-purple-500/25 bg-purple-500/10 text-purple-200";
  if (event.event_type === "push") return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export function shortSha(value?: string | null) {
  if (!value) return null;
  return value.slice(0, 7);
}

export function formatTaskDate(value?: string | null) {
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

export function toDateInputValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toISOString().slice(0, 10);
}

export function filterTaskGitHubEvents(
  events: GitHubEventItem[],
  task: TaskDetail
) {
  const taskKey = task.key.toUpperCase();

  // GitHub events can be linked by backend task id, stored task key, or text
  // discovered in commit/PR metadata. Keeping all three checks avoids missing
  // older events imported before the explicit task_id link existed.
  return events.filter((event) => {
    const eventTaskId = Number(event.task_id || 0);
    const eventTaskKey = (event.task_key || "").toUpperCase();
    const eventSummary = (event.summary || "").toUpperCase();

    return (
      eventTaskId === task.id ||
      eventTaskKey === taskKey ||
      eventSummary.includes(taskKey)
    );
  });
}
