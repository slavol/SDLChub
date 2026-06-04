"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Filter,
  Flag,
  LayoutList,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useDebouncedRealtimeEvent } from "@/hooks/use-realtime-event";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { getMyProjects, getProjectMembers, Project, ProjectMember } from "@/services/project";
import { getProjectSprints, Sprint } from "@/services/sprint";
import { getProjectTasks, Task, TaskPriority, TaskStatus, updateTask } from "@/services/task";
import { useProjectStore } from "@/store/use-project-store";

const statusLabels: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "To Do",
  [TaskStatus.IN_PROGRESS]: "In Progress",
  [TaskStatus.REVIEW]: "Review",
  [TaskStatus.DONE]: "Done",
};

const statusStyles: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskStatus.IN_PROGRESS]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskStatus.REVIEW]: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  [TaskStatus.DONE]: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const priorityStyles: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskPriority.MEDIUM]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskPriority.HIGH]: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  [TaskPriority.CRITICAL]: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

const statusOptions = Object.values(TaskStatus);
const priorityOptions = Object.values(TaskPriority);

function formatDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task: Task) {
  if (!task.due_date || task.status === TaskStatus.DONE) return false;
  const date = new Date(task.due_date);
  return !Number.isNaN(date.getTime()) && date < new Date();
}

function memberName(member: ProjectMember) {
  return member.user.full_name || member.user.email || `User #${member.user.id}`;
}

function TasksListSkeleton() {
  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="sdlc-page min-w-0 space-y-5">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-8 w-32 rounded-full" />
              <Skeleton className="h-10 w-72 max-w-full" />
              <Skeleton className="h-5 w-[28rem] max-w-full" />
            </div>
            <Skeleton className="h-11 w-44 rounded-xl" />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="border-slate-800 bg-slate-900 text-slate-50">
              <CardContent className="space-y-3 p-4">
                <Skeleton className="h-5 w-5 rounded-full" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-14" />
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
          <div className="border-b border-slate-800 p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-36 rounded-xl" />
                <Skeleton className="h-10 w-36 rounded-xl" />
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-800">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="grid gap-4 p-5 lg:grid-cols-[1fr_12rem_10rem_12rem_9rem_2rem]">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                  <Skeleton className="h-5 w-64 max-w-full" />
                </div>
                {Array.from({ length: 5 }).map((__, innerIndex) => (
                  <Skeleton key={innerIndex} className="h-11 rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function TasksListPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [sprintFilter, setSprintFilter] = useState("all");
  const [dueFilter, setDueFilter] = useState("all");

  const permissionProjectId = project?.id || currentProject?.id || null;
  const { can: canForProject } = useProjectPermissions(permissionProjectId);
  const canCreateTask = canForProject("TASK_CREATE");
  const canMoveTask = canForProject("TASK_MOVE");
  const canAssignTask = canForProject("TASK_ASSIGN");

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const projects = await getMyProjects();
      const selectedProject =
        currentProject && projects.some((item) => item.id === currentProject.id)
          ? currentProject
          : projects[0];

      if (!selectedProject) {
        setProject(null);
        setTasks([]);
        setMembers([]);
        setSprints([]);
        return;
      }

      setProject(selectedProject);
      setCurrentProject(selectedProject);

      const [remoteTasks, remoteMembers, remoteSprints] = await Promise.all([
        getProjectTasks(selectedProject.id, "backlog"),
        getProjectMembers(selectedProject.id),
        getProjectSprints(selectedProject.id),
      ]);

      setTasks(remoteTasks);
      setMembers(remoteMembers);
      setSprints(remoteSprints);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load task list."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useDebouncedRealtimeEvent(
    () => loadData(false),
    [project?.id, loadData],
    350,
    (message) => {
      if (!project?.id || message.project_id !== project.id) return false;
      return (
        message.type === "task.changed" ||
        message.type === "project.changed" ||
        message.type === "sprint.changed"
      );
    }
  );

  const memberByUserId = useMemo(() => {
    return new Map(members.map((member) => [member.user.id, member]));
  }, [members]);

  const sprintById = useMemo(() => {
    return new Map(sprints.map((sprint) => [sprint.id, sprint]));
  }, [sprints]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
      if (assigneeFilter === "unassigned" && task.assignee_id) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        String(task.assignee_id || "") !== assigneeFilter
      ) {
        return false;
      }
      if (sprintFilter === "backlog" && task.sprint_id) return false;
      if (
        sprintFilter !== "all" &&
        sprintFilter !== "backlog" &&
        String(task.sprint_id || "") !== sprintFilter
      ) {
        return false;
      }
      if (dueFilter === "overdue" && !isOverdue(task)) return false;
      if (dueFilter === "no_date" && task.due_date) return false;
      if (dueFilter === "due_soon") {
        if (!task.due_date || task.status === TaskStatus.DONE) return false;
        const dueDate = new Date(task.due_date);
        const weekEnd = new Date();
        weekEnd.setDate(weekEnd.getDate() + 7);
        if (Number.isNaN(dueDate.getTime()) || dueDate < new Date() || dueDate > weekEnd) {
          return false;
        }
      }
      if (!normalizedQuery) return true;

      return [task.key, task.title, task.assignee_name, task.team_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [assigneeFilter, deferredQuery, dueFilter, priorityFilter, sprintFilter, statusFilter, tasks]);

  const metrics = useMemo(() => {
    const active = tasks.filter((task) => task.status !== TaskStatus.DONE).length;
    const done = tasks.filter((task) => task.status === TaskStatus.DONE).length;
    const overdue = tasks.filter(isOverdue).length;
    const unassigned = tasks.filter((task) => task.status !== TaskStatus.DONE && !task.assignee_id).length;

    return { active, done, overdue, unassigned };
  }, [tasks]);

  const activeFilterCount = useMemo(() => {
    return [
      query.trim() ? "query" : "",
      statusFilter !== "all" ? "status" : "",
      priorityFilter !== "all" ? "priority" : "",
      assigneeFilter !== "all" ? "assignee" : "",
      sprintFilter !== "all" ? "planning" : "",
      dueFilter !== "all" ? "due" : "",
    ].filter(Boolean).length;
  }, [assigneeFilter, dueFilter, priorityFilter, query, sprintFilter, statusFilter]);

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
    setSprintFilter("all");
    setDueFilter("all");
  };

  const updateTaskField = async (task: Task, updates: Partial<Task>) => {
    setUpdatingTaskId(task.id);
    try {
      const updated = await updateTask(task.id, updates);
      setTasks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(`${task.key} updated`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update task."));
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (loading) {
    return <TasksListSkeleton />;
  }

  if (!project) {
    return (
      <div className="p-8 text-slate-300">
        Create or join a project before using the task list.
      </div>
    );
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="sdlc-page min-w-0 space-y-5">
        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                <LayoutList className="h-3.5 w-3.5" />
                List View
              </div>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Tasks for {project.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Scan, filter and update project work without leaving the table.
              </p>
            </div>

            {canCreateTask ? (
              <CreateTaskDialog
                projectId={project.id}
                methodology={project.methodology}
                onTaskCreated={(task) => setTasks((current) => [task, ...current])}
              />
            ) : (
              <Button disabled className="h-11 bg-slate-800 text-slate-500">
                Create issue
              </Button>
            )}
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-50">
            <CheckCircle2 className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Active</p>
            <p className="mt-1 text-2xl font-semibold text-white">{metrics.active}</p>
          </div>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === TaskStatus.DONE ? "all" : TaskStatus.DONE)}
            className={cn(
              "rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left text-slate-50 transition hover:border-emerald-500/35 hover:bg-emerald-500/5 focus:outline-none focus:ring-2 focus:ring-emerald-500/35",
              statusFilter === TaskStatus.DONE && "border-emerald-500/45 bg-emerald-500/10"
            )}
          >
            <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-sm text-slate-500">Done</p>
            <p className="mt-1 text-2xl font-semibold text-white">{metrics.done}</p>
          </button>

          <button
            type="button"
            onClick={() => setDueFilter(dueFilter === "overdue" ? "all" : "overdue")}
            className={cn(
              "rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left text-slate-50 transition hover:border-rose-500/35 hover:bg-rose-500/5 focus:outline-none focus:ring-2 focus:ring-rose-500/35",
              dueFilter === "overdue" && "border-rose-500/45 bg-rose-500/10"
            )}
          >
            <AlertTriangle className="mb-3 h-5 w-5 text-rose-300" />
            <p className="text-sm text-slate-500">Overdue</p>
            <p className={cn("mt-1 text-2xl font-semibold", metrics.overdue ? "text-rose-200" : "text-white")}>
              {metrics.overdue}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setAssigneeFilter(assigneeFilter === "unassigned" ? "all" : "unassigned")}
            className={cn(
              "rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left text-slate-50 transition hover:border-amber-500/35 hover:bg-amber-500/5 focus:outline-none focus:ring-2 focus:ring-amber-500/35",
              assigneeFilter === "unassigned" && "border-amber-500/45 bg-amber-500/10"
            )}
          >
            <UserRound className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-sm text-slate-500">Unassigned</p>
            <p className={cn("mt-1 text-2xl font-semibold", metrics.unassigned ? "text-amber-200" : "text-white")}>
              {metrics.unassigned}
            </p>
          </button>
        </section>

        <Card className="border-slate-800 bg-slate-900 text-slate-50">
          <CardHeader className="space-y-3 border-b border-slate-800 px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-blue-300" />
                  Task filters
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  {filteredTasks.length} visible out of {tasks.length} total tasks.
                </p>
              </div>

              <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDueFilter(dueFilter === "overdue" ? "all" : "overdue")}
                  className={cn(
                    "h-9 w-full border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900 sm:w-auto",
                    dueFilter === "overdue" && "border-rose-500/40 bg-rose-500/10 text-rose-200"
                  )}
                >
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Overdue
                  {metrics.overdue > 0 && (
                    <span className="ml-2 rounded-full bg-rose-500/20 px-2 py-0.5 text-xs text-rose-100">
                      {metrics.overdue}
                    </span>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={activeFilterCount === 0}
                  className="h-9 w-full border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                >
                  Clear filters
                  {activeFilterCount > 0 && (
                    <span className="ml-2 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-100">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                <div className="relative sm:col-span-2 lg:col-span-3 2xl:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search key, title, assignee..."
                    className="h-10 border-slate-700 bg-slate-950 pl-9"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All status</SelectItem>
                    {statusOptions.map((status) => (
                      <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All priority</SelectItem>
                    {priorityOptions.map((priority) => (
                      <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                  <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All assignees</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.membership_id} value={String(member.user.id)}>
                        {memberName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sprintFilter} onValueChange={setSprintFilter}>
                  <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All planning</SelectItem>
                    <SelectItem value="backlog">Backlog only</SelectItem>
                    {sprints.map((sprint) => (
                      <SelectItem key={sprint.id} value={String(sprint.id)}>
                        {sprint.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={dueFilter} onValueChange={setDueFilter}>
                  <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All due dates</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="due_soon">Due in 7 days</SelectItem>
                    <SelectItem value="no_date">No date</SelectItem>
                  </SelectContent>
                </Select>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {filteredTasks.map((task) => {
                const member = task.assignee_id ? memberByUserId.get(task.assignee_id) : null;
                const sprint = task.sprint_id ? sprintById.get(task.sprint_id) : null;
                const overdue = isOverdue(task);
                const updating = updatingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className="grid min-w-0 gap-3 bg-slate-900/45 px-4 py-3.5 text-sm transition hover:bg-slate-900 xl:grid-cols-[minmax(0,1.4fr)_150px_130px_180px_130px_42px] xl:items-center"
                  >
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-300">
                          {task.key}
                        </Badge>
                        {task.story_points ? (
                          <Badge variant="secondary" className="bg-slate-800 text-[11px] text-slate-300 hover:bg-slate-800">
                            {task.story_points} pts
                          </Badge>
                        ) : null}
                        {task.team_name && (
                          <span className="truncate text-xs text-slate-500">{task.team_name}</span>
                        )}
                      </div>
                      <Link
                        href={`/dashboard/tasks/${task.id}`}
                        className="block truncate font-semibold text-slate-100 hover:text-blue-300"
                      >
                        {task.title}
                      </Link>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600 xl:hidden">Status</p>
                      {canMoveTask ? (
                        <Select
                          value={task.status}
                          disabled={updating}
                          onValueChange={(value) => updateTaskField(task, { status: value as TaskStatus })}
                        >
                          <SelectTrigger className="h-9 w-full border-slate-700 bg-slate-950">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            {statusOptions.map((status) => (
                              <SelectItem key={status} value={status}>{statusLabels[status]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={cn("border", statusStyles[task.status])}>
                          {statusLabels[task.status]}
                        </Badge>
                      )}
                    </div>

                    <div>
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600 xl:hidden">Priority</p>
                      <Badge variant="outline" className={cn("border", priorityStyles[task.priority])}>
                        <Flag className="mr-1 h-3 w-3" />
                        {task.priority}
                      </Badge>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600 xl:hidden">Assignee</p>
                      {canAssignTask ? (
                        <Select
                          value={task.assignee_id ? String(task.assignee_id) : "unassigned"}
                          disabled={updating}
                          onValueChange={(value) =>
                            updateTaskField(task, {
                              assignee_id: value === "unassigned" ? null : Number(value),
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-full border-slate-700 bg-slate-950">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            <SelectItem value="unassigned">Unassigned</SelectItem>
                            {members.map((item) => (
                              <SelectItem key={item.membership_id} value={String(item.user.id)}>
                                {memberName(item)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex min-w-0 items-center gap-2">
                          <UserAvatar
                            name={task.assignee_name || "Unassigned"}
                            src={task.assignee_avatar_url || member?.user.avatar_url}
                            className="h-7 w-7"
                          />
                          <span className="truncate text-slate-300">
                            {task.assignee_name || "Unassigned"}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 text-slate-400">
                      <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-slate-600 xl:hidden">Planning / due</p>
                      <p className="truncate">{sprint ? sprint.name : "Backlog"}</p>
                      <div className={cn("mt-1 flex items-center gap-1.5 text-xs", overdue ? "text-rose-300" : "text-slate-500")}>
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(task.due_date)}
                      </div>
                    </div>

                    <Button asChild variant="ghost" size="icon" className="h-9 w-9 justify-self-start text-slate-400 hover:text-blue-300 xl:justify-self-end">
                      <Link href={`/dashboard/tasks/${task.id}`} aria-label={`Open ${task.key}`}>
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                );
              })}

              {filteredTasks.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <LayoutList className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                  <p className="font-medium text-slate-300">No tasks match these filters.</p>
                  <p className="mt-1 text-sm text-slate-500">Clear filters or create a new issue.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
