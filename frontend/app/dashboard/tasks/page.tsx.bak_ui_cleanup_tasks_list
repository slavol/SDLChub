"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Filter,
  Flag,
  LayoutList,
  Loader2,
  Search,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
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

export default function TasksListPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);

  const [query, setQuery] = useState("");
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

  useRealtimeEvent((message) => {
    if (!project?.id || message.project_id !== project.id) return;

    if (
      message.type === "task.created" ||
      message.type === "task.updated" ||
      message.type === "task.deleted" ||
      message.type === "project.changed" ||
      message.type === "sprint.changed"
    ) {
      loadData(false);
    }
  }, [project?.id, loadData]);

  const memberByUserId = useMemo(() => {
    return new Map(members.map((member) => [member.user.id, member]));
  }, [members]);

  const sprintById = useMemo(() => {
    return new Map(sprints.map((sprint) => [sprint.id, sprint]));
  }, [sprints]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

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
  }, [assigneeFilter, dueFilter, priorityFilter, query, sprintFilter, statusFilter, tasks]);

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
    return (
      <div className="flex h-full items-center justify-center text-blue-400">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
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
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                <LayoutList className="h-3.5 w-3.5" />
                List View
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="p-5">
              <CheckCircle2 className="mb-3 h-5 w-5 text-blue-300" />
              <p className="text-sm text-slate-500">Active</p>
              <p className="mt-1 text-3xl font-semibold text-white">{metrics.active}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="p-5">
              <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
              <p className="text-sm text-slate-500">Done</p>
              <p className="mt-1 text-3xl font-semibold text-white">{metrics.done}</p>
            </CardContent>
          </Card>
          <Card
            className={cn(
              "border-slate-800 bg-slate-900 text-slate-50 transition",
              dueFilter === "overdue" && "border-rose-500/45 bg-rose-500/10"
            )}
          >
            <button
              type="button"
              onClick={() => setDueFilter(dueFilter === "overdue" ? "all" : "overdue")}
              className="block w-full rounded-[inherit] p-5 text-left transition hover:bg-rose-500/5 focus:outline-none focus:ring-2 focus:ring-rose-500/35"
            >
              <AlertTriangle className="mb-3 h-5 w-5 text-rose-300" />
              <p className="text-sm text-slate-500">Overdue</p>
              <p className={cn("mt-1 text-3xl font-semibold", metrics.overdue ? "text-rose-200" : "text-white")}>
                {metrics.overdue}
              </p>
            </button>
          </Card>
          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="p-5">
              <UserRound className="mb-3 h-5 w-5 text-amber-300" />
              <p className="text-sm text-slate-500">Unassigned</p>
              <p className={cn("mt-1 text-3xl font-semibold", metrics.unassigned ? "text-amber-200" : "text-white")}>
                {metrics.unassigned}
              </p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-slate-800 bg-slate-900 text-slate-50">
          <CardHeader className="space-y-4 border-b border-slate-800">
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

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDueFilter(dueFilter === "overdue" ? "all" : "overdue")}
                  className={cn(
                    "h-9 border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900",
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
                  className="h-9 border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
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

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-xs uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-5 py-4 font-medium">Issue</th>
                    <th className="px-4 py-4 font-medium">Status</th>
                    <th className="px-4 py-4 font-medium">Priority</th>
                    <th className="px-4 py-4 font-medium">Assignee</th>
                    <th className="px-4 py-4 font-medium">Planning</th>
                    <th className="px-4 py-4 font-medium">Due</th>
                    <th className="px-4 py-4 text-right font-medium">Open</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredTasks.map((task) => {
                    const member = task.assignee_id ? memberByUserId.get(task.assignee_id) : null;
                    const sprint = task.sprint_id ? sprintById.get(task.sprint_id) : null;
                    const overdue = isOverdue(task);
                    const updating = updatingTaskId === task.id;

                    return (
                      <tr key={task.id} className="bg-slate-900/55 transition hover:bg-slate-900">
                        <td className="px-5 py-4">
                          <div className="flex min-w-0 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-300">
                                {task.key}
                              </Badge>
                              {task.story_points ? (
                                <Badge variant="secondary" className="bg-slate-800 text-xs text-slate-300 hover:bg-slate-800">
                                  {task.story_points} pts
                                </Badge>
                              ) : null}
                            </div>
                            <Link href={`/dashboard/tasks/${task.id}`} className="max-w-xl truncate font-semibold text-slate-100 hover:text-blue-300">
                              {task.title}
                            </Link>
                            {task.team_name && (
                              <p className="text-xs text-slate-500">{task.team_name}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {canMoveTask ? (
                            <Select
                              value={task.status}
                              disabled={updating}
                              onValueChange={(value) => updateTaskField(task, { status: value as TaskStatus })}
                            >
                              <SelectTrigger className="h-9 w-36 border-slate-700 bg-slate-950">
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
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant="outline" className={cn("border", priorityStyles[task.priority])}>
                            <Flag className="mr-1 h-3 w-3" />
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-4">
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
                              <SelectTrigger className="h-9 w-48 border-slate-700 bg-slate-950">
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
                            <div className="flex items-center gap-2">
                              <UserAvatar
                                name={task.assignee_name || "Unassigned"}
                                src={task.assignee_avatar_url || member?.user.avatar_url}
                                className="h-8 w-8"
                              />
                              <span className="max-w-36 truncate text-slate-300">
                                {task.assignee_name || "Unassigned"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4 text-slate-400">
                          {sprint ? sprint.name : "Backlog"}
                        </td>
                        <td className="px-4 py-4">
                          <div className={cn("flex items-center gap-2", overdue ? "text-rose-300" : "text-slate-400")}>
                            <CalendarClock className="h-4 w-4" />
                            {formatDate(task.due_date)}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-blue-300">
                            <Link href={`/dashboard/tasks/${task.id}`} aria-label={`Open ${task.key}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredTasks.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <LayoutList className="mx-auto mb-3 h-8 w-8 text-slate-700" />
                        <p className="font-medium text-slate-300">No tasks match these filters.</p>
                        <p className="mt-1 text-sm text-slate-500">Clear filters or create a new issue.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
