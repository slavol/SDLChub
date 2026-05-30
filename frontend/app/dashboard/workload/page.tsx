"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  getMyProjects,
  getProjectWorkload,
  getProjectWorkloadSuggestions,
  Project,
  ProjectWorkload,
  WorkloadMember,
  WorkloadSuggestion,
  WorkloadTask,
} from "@/services/project";
import { updateTask } from "@/services/task";
import { useProjectStore } from "@/store/use-project-store";
import { useProjectPermissions } from "@/hooks/use-project-permissions";

function formatDate(value?: string | null) {
  if (!value) return "No due date";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function isOverdue(value?: string | null) {
  if (!value) return false;

  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return false;

  return dueDate.getTime() < Date.now();
}

function riskTone(score: number) {
  if (score >= 70) {
    return {
      badge: "border-red-500/30 bg-red-500/10 text-red-200",
      bar: "bg-red-500",
      text: "text-red-300",
    };
  }

  if (score >= 40) {
    return {
      badge: "border-amber-500/30 bg-amber-500/10 text-amber-200",
      bar: "bg-amber-500",
      text: "text-amber-300",
    };
  }

  return {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    bar: "bg-emerald-500",
    text: "text-emerald-300",
  };
}

function priorityTone(priority: string) {
  if (priority === "CRITICAL") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (priority === "HIGH") return "border-orange-500/30 bg-orange-500/10 text-orange-200";
  if (priority === "MEDIUM") return "border-blue-500/30 bg-blue-500/10 text-blue-200";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

function TaskMiniCard({
  task,
  members,
  canAssign,
  onAssign,
}: {
  task: WorkloadTask;
  members: WorkloadMember[];
  canAssign: boolean;
  onAssign: (task: WorkloadTask, userId: number | null) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/dashboard/tasks/${task.id}`}
            className="text-xs font-semibold text-blue-300 hover:text-blue-200"
          >
            {task.key}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-white">
            {task.title}
          </p>
        </div>

        <Badge className={cn("shrink-0", priorityTone(task.priority))}>
          {task.priority}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="rounded-full border border-slate-800 px-2 py-1">
          {task.status.replace("_", " ")}
        </span>
        <span className="rounded-full border border-slate-800 px-2 py-1">
          {task.story_points ?? 0} pts
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-1",
            isOverdue(task.due_date)
              ? "border-red-500/30 bg-red-500/10 text-red-200"
              : "border-slate-800"
          )}
        >
          <CalendarClock className="h-3 w-3" />
          {formatDate(task.due_date)}
        </span>
      </div>

      {canAssign && (
        <div className="mt-3">
          <Select
            value={task.assignee_id ? String(task.assignee_id) : "unassigned"}
            onValueChange={(value) => {
              onAssign(task, value === "unassigned" ? null : Number(value));
            }}
          >
            <SelectTrigger className="h-9 rounded-xl border-slate-800 bg-slate-900 text-xs text-slate-200">
              <SelectValue placeholder="Assign task" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-950 text-slate-100">
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((member) => (
                <SelectItem key={member.user_id} value={String(member.user_id)}>
                  {member.full_name || member.email || `User #${member.user_id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function MemberWorkloadCard({
  member,
  members,
  canAssign,
  onAssign,
}: {
  member: WorkloadMember;
  members: WorkloadMember[];
  canAssign: boolean;
  onAssign: (task: WorkloadTask, userId: number | null) => void;
}) {
  const tone = riskTone(member.risk_score);
  const displayName = member.full_name || member.email || "Team member";

  return (
    <Card className="border-slate-800 bg-slate-900/70 shadow-2xl shadow-slate-950/20">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar
              name={displayName}
              email={member.email}
              src={resolveMediaUrl(member.avatar_url)}
              className="h-12 w-12"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-white">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {member.role_name}
              </p>
            </div>
          </div>

          <Badge className={cn("shrink-0", tone.badge)}>
            {member.load_label}
          </Badge>
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="text-slate-500">Risk score</span>
            <span className={cn("font-semibold", tone.text)}>
              {member.risk_score}/100
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={cn("h-full rounded-full", tone.bar)}
              style={{ width: `${Math.min(100, member.risk_score)}%` }}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-500">Active</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {member.active_tasks}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-500">Points</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {member.story_points}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-500">Overdue</p>
            <p className={cn("mt-1 text-xl font-semibold", member.overdue_tasks ? "text-red-300" : "text-white")}>
              {member.overdue_tasks}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="text-xs text-slate-500">Review</p>
            <p className="mt-1 text-xl font-semibold text-white">
              {member.review_tasks}
            </p>
          </div>
        </div>

        {member.risk_factors && member.risk_factors.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Capacity signals
            </p>
            <div className="flex flex-wrap gap-2">
              {member.risk_factors.map((factor) => (
                <Badge
                  key={`${member.user_id}-${factor}`}
                  variant="outline"
                  className="border-slate-700 bg-slate-900/70 text-slate-300"
                >
                  {factor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-3">
          {member.tasks.slice(0, 4).map((task) => (
            <TaskMiniCard
              key={task.id}
              task={task}
              members={members}
              canAssign={canAssign}
              onAssign={onAssign}
            />
          ))}

          {member.tasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-emerald-300" />
              <p className="text-sm text-slate-400">
                No active tasks assigned.
              </p>
            </div>
          )}

          {member.tasks.length > 4 && (
            <p className="text-center text-xs text-slate-500">
              +{member.tasks.length - 4} more active tasks
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SuggestionCard({ suggestion }: { suggestion: WorkloadSuggestion }) {
  const tone =
    suggestion.severity === "high"
      ? "border-red-500/20 bg-red-500/10 text-red-200"
      : suggestion.severity === "medium"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge className={tone}>{suggestion.severity}</Badge>
        {suggestion.task_key && (
          <Link
            href={`/dashboard/tasks/${suggestion.task_id}`}
            className="text-sm font-semibold text-blue-300 hover:text-blue-200"
          >
            {suggestion.task_key}
          </Link>
        )}
      </div>

      {suggestion.task_title && (
        <p className="mb-3 text-sm font-medium text-white">
          {suggestion.task_title}
        </p>
      )}

      {suggestion.from_name && suggestion.to_name && (
        <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
          <span>{suggestion.from_name}</span>
          <ArrowRight className="h-4 w-4 text-slate-500" />
          <span>{suggestion.to_name}</span>
        </div>
      )}

      <p className="text-sm leading-6 text-slate-400">
        {suggestion.reason}
      </p>
    </div>
  );
}

export default function WorkloadPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [workload, setWorkload] = useState<ProjectWorkload | null>(null);
  const [suggestions, setSuggestions] = useState<WorkloadSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);

  const projectId = project?.id || currentProject?.id || null;
  const { can } = useProjectPermissions(projectId);
  const canAssignTasks = can("TASK_ASSIGN");
  const canUseAi = can("AI_USE");

  const loadWorkload = useCallback(async () => {
    setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = projects[0] ?? null;

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      if (!selectedProject) {
        setProject(null);
        setWorkload(null);
        return;
      }

      setProject(selectedProject);

      const remoteWorkload = await getProjectWorkload(selectedProject.id);
      setWorkload(remoteWorkload);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load workload data."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadWorkload();
  }, [loadWorkload]);

  const sortedMembers = useMemo(() => workload?.members || [], [workload?.members]);

  const handleGenerateSuggestions = async () => {
    if (!project) return;

    setSuggestionsLoading(true);

    try {
      const response = await getProjectWorkloadSuggestions(project.id);
      setSuggestions(response.suggestions);
      toast.success("Workload suggestions generated.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not generate workload suggestions."));
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleAssign = async (task: WorkloadTask, userId: number | null) => {
    if (!canAssignTasks) {
      toast.error("You do not have permission to assign tasks.");
      return;
    }

    setAssigningTaskId(task.id);

    try {
      await updateTask(task.id, { assignee_id: userId || undefined });
      toast.success(userId ? "Task reassigned." : "Task marked as unassigned.");
      await loadWorkload();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not update task assignee."));
    } finally {
      setAssigningTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project || !workload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <Card className="max-w-lg border-slate-800 bg-slate-900/80">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-4 h-10 w-10 text-blue-300" />
            <h1 className="text-xl font-semibold text-white">No project selected</h1>
            <p className="mt-2 text-sm text-slate-400">
              Create or join a project before using Workload Balancer.
            </p>
            <Button asChild className="mt-5 bg-blue-600 hover:bg-blue-700">
              <Link href="/onboarding">Go to onboarding</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summaryCards = [
    {
      label: "Active tasks",
      value: workload.summary.active_tasks,
      icon: UserRound,
    },
    {
      label: "Story points",
      value: workload.summary.total_story_points,
      icon: Sparkles,
    },
    {
      label: "Overdue",
      value: workload.summary.overdue_tasks,
      icon: AlertTriangle,
      danger: workload.summary.overdue_tasks > 0,
    },
    {
      label: "Overloaded members",
      value: workload.summary.overloaded_members,
      icon: Users,
      danger: workload.summary.overloaded_members > 0,
    },
    {
      label: "Stale flow",
      value: workload.summary.stale_flow_tasks || 0,
      icon: CalendarClock,
      danger: (workload.summary.stale_flow_tasks || 0) > 0,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            <Users className="h-3.5 w-3.5" />
            Workload Balancer
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Team capacity for {project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Analyze active tasks, story points, overdue work and review queues to identify overloaded members.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={loadWorkload}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleGenerateSuggestions}
            disabled={!canUseAi || suggestionsLoading}
            title={!canUseAi ? "You do not have permission to use AI features." : undefined}
          >
            {suggestionsLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Bot className="mr-2 h-4 w-4" />
            )}
            Generate suggestions
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-slate-800 bg-slate-900/70">
              <CardContent className="p-5">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
                  <Icon className={cn("h-5 w-5", item.danger ? "text-red-300" : "text-blue-300")} />
                </div>
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className={cn("mt-1 text-3xl font-bold", item.danger ? "text-red-300" : "text-white")}>
                  {item.value}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {workload.unassigned_tasks.length > 0 && (
        <Card className="mb-6 border-amber-500/20 bg-amber-500/10">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              <h2 className="text-lg font-semibold text-white">
                Unassigned work
              </h2>
              <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                {workload.summary.unassigned_tasks} tasks
              </Badge>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {workload.unassigned_tasks.slice(0, 4).map((task) => (
                <TaskMiniCard
                  key={task.id}
                  task={task}
                  members={sortedMembers}
                  canAssign={canAssignTasks}
                  onAssign={handleAssign}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {assigningTaskId && (
        <div className="mb-4 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          Updating task #{assigningTaskId}...
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {sortedMembers.map((member) => (
          <MemberWorkloadCard
            key={member.user_id}
            member={member}
            members={sortedMembers}
            canAssign={canAssignTasks}
            onAssign={handleAssign}
          />
        ))}
      </div>

      {suggestions.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-300" />
            <h2 className="text-xl font-semibold text-white">
              Workload suggestions
            </h2>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {suggestions.map((suggestion, index) => (
              <SuggestionCard
                key={`${suggestion.type}-${suggestion.task_id ?? index}-${index}`}
                suggestion={suggestion}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
