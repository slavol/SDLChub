"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getMyProjects } from "@/services/project";
import { getProjectTasks, updateTask, Task } from "@/services/task";
import { getProjectSprints, createSprint, startSprint, Sprint } from "@/services/sprint";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import {
    Loader2,
    ChevronRight,
    MoreHorizontal,
    ArrowRightCircle,
    Archive,
    CalendarClock,
    CircleDot,
    Flag,
    KanbanSquare,
    PlayCircle,
    UserRound
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-error";
import { useProjectStore } from "@/store/use-project-store";

const priorityStyles: Record<string, string> = {
    LOW: "border-slate-700 bg-slate-800/70 text-slate-300",
    MEDIUM: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    HIGH: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    CRITICAL: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

const statusStyles: Record<string, string> = {
    TODO: "border-slate-700 bg-slate-800/70 text-slate-300",
    IN_PROGRESS: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    REVIEW: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    DONE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const statusLabels: Record<string, string> = {
    TODO: "To Do",
    IN_PROGRESS: "In Progress",
    REVIEW: "Review",
    DONE: "Done",
};

function formatDate(value?: string | null) {
    if (!value) return "No date";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No date";

    return date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

// --- COMPONENTA RAND TASK ---
// Acum accepta lista de sprinturi pentru a popula meniul
function BacklogTaskRow({
    task,
    sprints,
    onMoveTask
}: {
    task: Task,
    sprints: Sprint[],
    onMoveTask?: (taskId: number, sprintId: number | null) => void
}) {
    const activeOrFutureSprints = sprints;
    const assigneeName = task.assignee_name || "Unassigned";
    const dueDate = formatDate(task.due_date);

    return (
        <div className="group mb-2 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/75 p-4 transition hover:border-blue-500/35 hover:bg-slate-900 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                        variant="outline"
                        className="border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-300"
                    >
                        {task.key}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn("border text-[10px]", priorityStyles[task.priority] || priorityStyles.MEDIUM)}
                    >
                        <Flag className="mr-1 h-3 w-3" />
                        {task.priority}
                    </Badge>
                    <Badge
                        variant="outline"
                        className={cn("border text-[10px]", statusStyles[task.status] || statusStyles.TODO)}
                    >
                        {statusLabels[task.status] || task.status}
                    </Badge>
                </div>

                <Link
                    href={`/dashboard/tasks/${task.id}`}
                    className="block truncate text-sm font-semibold text-slate-100 hover:text-blue-300"
                >
                    {task.title}
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        <CircleDot className="h-3.5 w-3.5" />
                        {task.story_points ? `${task.story_points} pts` : "No estimate"}
                    </span>
                    <span className="flex items-center gap-1">
                        <UserRound className="h-3.5 w-3.5" />
                        {assigneeName}
                    </span>
                    {task.due_date && (
                        <span className="flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {dueDate}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 md:justify-end">
                <UserAvatar
                    name={task.assignee_id ? assigneeName : "Not assigned"}
                    src={task.assignee_avatar_url}
                    className="h-8 w-8"
                    fallbackClassName={cn(
                        "text-[10px] font-bold",
                        task.assignee_id
                            ? "bg-blue-500/15 text-blue-200"
                            : "bg-slate-800 text-slate-500"
                    )}
                />

                {/* DROPDOWN PENTRU MUTARE */}
                {onMoveTask && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-9 w-9 rounded-xl p-0 text-slate-500 opacity-100 transition hover:bg-slate-800 hover:text-white md:opacity-0 md:group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-slate-800 bg-slate-950 text-slate-200">
                        <DropdownMenuLabel>Move to</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-slate-800" />

                        {/* Optiune Backlog */}
                        {task.sprint_id && (
                            <DropdownMenuItem onClick={() => onMoveTask(task.id, null)} className="cursor-pointer hover:bg-slate-900">
                                <Archive className="mr-2 h-4 w-4" /> Backlog
                            </DropdownMenuItem>
                        )}

                        {/* Optiuni Sprinturi */}
                        {activeOrFutureSprints.map(sprint => (
                            sprint.id !== task.sprint_id && (
                                <DropdownMenuItem key={sprint.id} onClick={() => onMoveTask(task.id, sprint.id)} className="cursor-pointer hover:bg-slate-900">
                                    <ArrowRightCircle className="mr-2 h-4 w-4" /> {sprint.name}
                                </DropdownMenuItem>
                            )
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
                )}
            </div>
        </div>
    );
}

export default function BacklogPage() {
    const { currentProject, setCurrentProject } = useProjectStore();
    const [projectId, setProjectId] = useState<number | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [loading, setLoading] = useState(true);
    const [isKanbanFlow, setIsKanbanFlow] = useState(false);

    const [newSprintName, setNewSprintName] = useState("");
    const [newSprintGoal, setNewSprintGoal] = useState("");
    const [newSprintStartDate, setNewSprintStartDate] = useState("");
    const [newSprintEndDate, setNewSprintEndDate] = useState("");
    const [isCreatingSprint, setIsCreatingSprint] = useState(false);
    const { can } = useProjectPermissions(projectId);
    const canCreateTask = can("TASK_CREATE");
    const canCreateSprint = can("SPRINT_CREATE");
    const canStartSprint = can("SPRINT_START");
    const canPlanTasks = can("TASK_UPDATE");

    const loadBacklog = useCallback(
        async (showLoader = true) => {
            if (showLoader) setLoading(true);
            try {
                let project = currentProject;

                if (!project) {
                    const projects = await getMyProjects();
                    project = projects[0] ?? null;

                    if (project) {
                        setCurrentProject(project);
                    }
                }

                if (project) {
                    const pid = project.id;
                    setProjectId(pid);

                    if (project.methodology === "KANBAN") {
                        setIsKanbanFlow(true);
                        setTasks([]);
                        setSprints([]);
                        return;
                    }

                    setIsKanbanFlow(false);

                    const [remoteTasks, remoteSprints] = await Promise.all([
                        getProjectTasks(pid, "backlog"),
                        getProjectSprints(pid)
                    ]);

                    setTasks(remoteTasks);
                    setSprints(remoteSprints);
                }
            } catch (e) {
                console.error(e);
                toast.error("Failed to load backlog");
            } finally {
                setLoading(false);
            }
        },
        [currentProject, setCurrentProject]
    );

    useEffect(() => {
        loadBacklog();
    }, [loadBacklog]);

    useRealtimeEvent((message) => {
        if (!projectId || (message.project_id && message.project_id !== projectId)) return;

        if (message.type === "task.changed" || message.type === "sprint.changed") {
            loadBacklog(false);
        }
    }, [projectId, loadBacklog]);

    const handleCreateSprint = async () => {
        if (!canCreateSprint) return;
        if (!projectId || !newSprintName) return;
        setIsCreatingSprint(true);
        try {
            const sprint = await createSprint(projectId, {
                name: newSprintName,
                goal: newSprintGoal || undefined,
                start_date: newSprintStartDate ? `${newSprintStartDate}T09:00:00` : undefined,
                end_date: newSprintEndDate ? `${newSprintEndDate}T18:00:00` : undefined,
            });
            setSprints([sprint, ...sprints]);
            toast.success("Sprint created!");
            setNewSprintName("");
            setNewSprintGoal("");
            setNewSprintStartDate("");
            setNewSprintEndDate("");
        } catch {
            toast.error("Failed to create sprint");
        } finally {
            setIsCreatingSprint(false);
        }
    };

    const handleStartSprint = async (sprintId: number) => {
        if (!canStartSprint) return;

        try {
            await startSprint(sprintId);
            toast.success("Sprint Started! Go to Board.");
            setSprints(sprints.map(s => s.id === sprintId ? { ...s, is_active: true } : s));
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, "Failed to start sprint"));
        }
    };

    // --- LOGICA DE MUTARE TASK ---
    const handleMoveTask = async (taskId: number, sprintId: number | null) => {
        if (!canPlanTasks) return;

        try {
            // Optimistic update
            const updatedTasks = tasks.map(t =>
                t.id === taskId ? { ...t, sprint_id: sprintId } : t
            );
            setTasks(updatedTasks);

            // API Call
            // Nota: backend-ul trebuie sa stie sa interpreteze 0 sau null ca 'Backlog'
            await updateTask(taskId, { sprint_id: sprintId === null ? 0 : sprintId });

            toast.success("Task moved");
        } catch {
            toast.error("Failed to move task");
            // Revert ar fi ideal aici
        }
    };

    const backlogTasks = tasks.filter(t => !t.sprint_id);
    const sprintTasksCount = tasks.length - backlogTasks.length;
    const activeSprint = sprints.find((sprint) => sprint.is_active);

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

    if (isKanbanFlow) {
        return (
            <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center p-6 text-slate-50 md:p-8">
                <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/25">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
                                <KanbanSquare className="h-7 w-7" />
                            </div>
                            <div>
                                <Badge className="mb-3 border-blue-500/25 bg-blue-500/10 text-blue-200">
                                    Kanban flow
                                </Badge>
                                <h1 className="text-3xl font-semibold tracking-tight text-white">
                                    Backlog is disabled for Kanban
                                </h1>
                                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                                    This project uses continuous flow. Work is planned directly on the board,
                                    without sprint planning or a separate backlog.
                                </p>
                            </div>
                        </div>

                        <Button asChild className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500">
                            <Link href="/dashboard/board">
                                <KanbanSquare className="mr-2 h-4 w-4" />
                                Open Board
                            </Link>
                        </Button>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-8 p-6 text-slate-50 md:p-8">
            <section className="rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/25">
                <div className="flex flex-col gap-5 border-b border-slate-800 bg-slate-950/45 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Badge className="bg-blue-600 text-white">Planning</Badge>
                            {activeSprint && (
                                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                                    Active: {activeSprint.name}
                                </Badge>
                            )}
                        </div>
                        <h1 className="text-3xl font-semibold tracking-tight text-white">Backlog</h1>
                        <p className="mt-2 max-w-2xl text-sm text-slate-400">
                            Prioritize work, shape upcoming sprints and keep unplanned tasks visible.
                        </p>
                    </div>

                    {projectId && canCreateTask && (
                        <CreateTaskDialog
                            projectId={projectId}
                            methodology={currentProject?.methodology}
                            onTaskCreated={(t) => setTasks([...tasks, t])}
                        />
                    )}
                </div>

                <div className="grid gap-4 p-5 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <CircleDot className="mb-3 h-5 w-5 text-blue-300" />
                        <p className="text-2xl font-semibold text-white">{backlogTasks.length}</p>
                        <p className="text-xs text-slate-500">backlog issues</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <CalendarClock className="mb-3 h-5 w-5 text-amber-300" />
                        <p className="text-2xl font-semibold text-white">{sprints.length}</p>
                        <p className="text-xs text-slate-500">planned sprints</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <PlayCircle className="mb-3 h-5 w-5 text-emerald-300" />
                        <p className="text-2xl font-semibold text-white">{sprintTasksCount}</p>
                        <p className="text-xs text-slate-500">issues assigned to sprints</p>
                    </div>
                </div>
            </section>

            {/* SPRINT LIST */}
            <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                <div>
                        <h2 className="text-lg font-semibold text-white">Sprint Planning</h2>
                        <p className="text-sm text-slate-500">Move tasks into a sprint and start execution when ready.</p>
                </div>

                    {canCreateSprint && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="border-dashed border-slate-700 bg-slate-950/60 text-slate-300 hover:bg-slate-900 hover:text-white">
                                Create Sprint
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="border-slate-800 bg-slate-950 text-white">
                            <DialogHeader>
                                <DialogTitle>Create Sprint</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Sprint Name</label>
                                    <Input
                                        placeholder="Sprint Name (e.g. Sprint 1)"
                                        value={newSprintName}
                                        onChange={(e) => setNewSprintName(e.target.value)}
                                        className="border-slate-700 bg-slate-900"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-300">Sprint Goal</label>
                                    <Input
                                        placeholder="What should this sprint achieve?"
                                        value={newSprintGoal}
                                        onChange={(e) => setNewSprintGoal(e.target.value)}
                                        className="border-slate-700 bg-slate-900"
                                    />
                                </div>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Start Date</label>
                                        <Input
                                            type="date"
                                            value={newSprintStartDate}
                                            onChange={(e) => setNewSprintStartDate(e.target.value)}
                                            className="border-slate-700 bg-slate-900"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-300">Target End Date</label>
                                        <Input
                                            type="date"
                                            value={newSprintEndDate}
                                            onChange={(e) => setNewSprintEndDate(e.target.value)}
                                            className="border-slate-700 bg-slate-900"
                                        />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCreateSprint} disabled={isCreatingSprint}>Create</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    )}
                </div>

                {sprints.map((sprint) => (
                    <Card key={sprint.id} className="overflow-hidden border-slate-800 bg-slate-900/70 p-0 shadow-xl shadow-slate-950/20">
                        <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950/35 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
                                    <ChevronRight className="h-4 w-4 text-slate-500" />
                                </div>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-slate-100">{sprint.name}</h3>
                                        {sprint.is_active && <Badge className="border-green-500/20 bg-green-500/10 text-green-400">ACTIVE</Badge>}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {tasks.filter(t => t.sprint_id === sprint.id).length} issues planned · Ends {formatDate(sprint.end_date)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {!sprint.is_active && canStartSprint && (
                                    <Button
                                        size="sm"
                                        className="bg-blue-600 text-white hover:bg-blue-700"
                                        onClick={() => handleStartSprint(sprint.id)}
                                    >
                                        <PlayCircle className="mr-2 h-4 w-4" />
                                        Start Sprint
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 p-4">
                            {tasks.filter(t => t.sprint_id === sprint.id).length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 p-6 text-center">
                                    <p className="text-sm font-medium text-slate-500">No tasks in this sprint.</p>
                                    <p className="mt-1 text-xs text-slate-600">Move backlog work here when planning is ready.</p>
                                </div>
                            ) : (
                                tasks.filter(t => t.sprint_id === sprint.id).map(task => (
                                    <BacklogTaskRow
                                        key={task.id}
                                        task={task}
                                        sprints={sprints}
                                        onMoveTask={canPlanTasks ? handleMoveTask : undefined}
                                    />
                                ))
                            )}
                        </div>
                    </Card>
                ))}
            </section>

            {/* BACKLOG */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">Unplanned Backlog</h2>
                    <Badge variant="secondary" className="bg-slate-800 text-xs text-slate-300 hover:bg-slate-800">{backlogTasks.length} issues</Badge>
                </div>

                <div className="min-h-[220px] rounded-3xl border border-slate-800 bg-slate-950/45 p-3">
                    {backlogTasks.map(task => (
                        <BacklogTaskRow
                            key={task.id}
                            task={task}
                            sprints={sprints}
                            onMoveTask={canPlanTasks ? handleMoveTask : undefined}
                        />
                    ))}
                    {backlogTasks.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-sm text-slate-600">
                            Your backlog is empty. Create a task or move unfinished work back here.
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
