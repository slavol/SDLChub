"use client";

import { useEffect, useState } from "react";
import { getMyProjects } from "@/services/project";
import { getProjectTasks, updateTask, Task } from "@/services/task";
import { getProjectSprints, createSprint, startSprint, Sprint } from "@/services/sprint";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import {
    Loader2,
    Plus,
    ChevronRight,
    MoreHorizontal,
    ArrowRightCircle,
    Archive
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

// --- COMPONENTA RAND TASK ---
// Acum accepta lista de sprinturi pentru a popula meniul
function BacklogTaskRow({
    task,
    sprints,
    onMoveTask
}: {
    task: Task,
    sprints: Sprint[],
    onMoveTask: (taskId: number, sprintId: number | null) => void
}) {
    const activeOrFutureSprints = sprints.filter(s => s.status !== 'closed');

    return (
        <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-md mb-2 hover:border-slate-600 transition group">
            <div className="flex items-center gap-3">
                <Badge variant="outline" className={cn(
                    "text-[10px] w-16 justify-center",
                    task.priority === "CRITICAL" ? "border-red-500 text-red-500" : "border-slate-700 text-slate-400"
                )}>
                    {task.key}
                </Badge>
                <span className="text-sm font-medium text-slate-200">{task.title}</span>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant="secondary" className="bg-slate-800 text-slate-400">
                    {task.story_points ? `${task.story_points} pts` : "-"}
                </Badge>

                {/* DROPDOWN PENTRU MUTARE */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-slate-950 border-slate-800 text-slate-200">
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
            </div>
        </div>
    )
}

export default function BacklogPage() {
    const [projectId, setProjectId] = useState<number | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [sprints, setSprints] = useState<Sprint[]>([]);
    const [loading, setLoading] = useState(true);

    const [newSprintName, setNewSprintName] = useState("");
    const [isCreatingSprint, setIsCreatingSprint] = useState(false);

    useEffect(() => {
        const init = async () => {
            try {
                const projects = await getMyProjects();
                if (projects.length > 0) {
                    const pid = projects[0].id;
                    setProjectId(pid);

                    const [remoteTasks, remoteSprints] = await Promise.all([
                        getProjectTasks(pid),
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
        };
        init();
    }, []);

    const handleCreateSprint = async () => {
        if (!projectId || !newSprintName) return;
        setIsCreatingSprint(true);
        try {
            const sprint = await createSprint(projectId, newSprintName);
            setSprints([sprint, ...sprints]);
            toast.success("Sprint created!");
            setNewSprintName("");
        } catch (e) {
            toast.error("Failed to create sprint");
        } finally {
            setIsCreatingSprint(false);
        }
    };

    const handleStartSprint = async (sprintId: number) => {
        try {
            await startSprint(sprintId);
            toast.success("Sprint Started! Go to Board.");
            setSprints(sprints.map(s => s.id === sprintId ? { ...s, is_active: true } : s));
        } catch (e: any) {
            toast.error(e.response?.data?.detail || "Failed to start sprint");
        }
    };

    // --- LOGICA DE MUTARE TASK ---
    const handleMoveTask = async (taskId: number, sprintId: number | null) => {
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
        } catch (error) {
            toast.error("Failed to move task");
            // Revert ar fi ideal aici
        }
    };

    const backlogTasks = tasks.filter(t => !t.sprint_id);

    if (loading) return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

    return (
        <div className="p-6 max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white">Backlog</h1>
                    <p className="text-slate-400 text-sm">Plan your sprints and prioritize work.</p>
                </div>
                {projectId && (
                    <CreateTaskDialog
                        projectId={projectId}
                        onTaskCreated={(t) => setTasks([...tasks, t])}
                    />
                )}
            </div>

            {/* SPRINT LIST */}
            <div className="space-y-4">
                {sprints.map((sprint) => (
                    <Card key={sprint.id} className="bg-slate-950/50 border-slate-800 p-4">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                                <ChevronRight className="w-4 h-4 text-slate-500" />
                                <h3 className="font-bold text-lg text-slate-200">{sprint.name}</h3>
                                {sprint.is_active && <Badge className="bg-green-500/10 text-green-400 border-green-500/20">ACTIVE</Badge>}
                                <span className="text-xs text-slate-500">
                                    {tasks.filter(t => t.sprint_id === sprint.id).length} issues
                                </span>
                            </div>
                            <div className="flex gap-2">
                                {!sprint.is_active && (
                                    <Button
                                        size="sm"
                                        className="bg-slate-800 hover:bg-slate-700 text-slate-300"
                                        onClick={() => handleStartSprint(sprint.id)}
                                    >
                                        Start Sprint
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="pl-4 border-l-2 border-slate-800 ml-2 space-y-1">
                            {tasks.filter(t => t.sprint_id === sprint.id).length === 0 ? (
                                <p className="text-xs text-slate-600 py-2 italic">No tasks in this sprint.</p>
                            ) : (
                                tasks.filter(t => t.sprint_id === sprint.id).map(task => (
                                    <BacklogTaskRow
                                        key={task.id}
                                        task={task}
                                        sprints={sprints}
                                        onMoveTask={handleMoveTask}
                                    />
                                ))
                            )}
                        </div>
                    </Card>
                ))}

                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-dashed border-slate-700 text-slate-400 hover:text-white hover:bg-slate-900">
                            Create Sprint
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-950 border-slate-800 text-white">
                        <DialogHeader><DialogTitle>Create Sprint</DialogTitle></DialogHeader>
                        <Input
                            placeholder="Sprint Name (e.g. Sprint 1)"
                            value={newSprintName}
                            onChange={(e) => setNewSprintName(e.target.value)}
                            className="bg-slate-900 border-slate-700"
                        />
                        <DialogFooter>
                            <Button onClick={handleCreateSprint} disabled={isCreatingSprint}>Create</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* BACKLOG */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                    <h3 className="font-bold text-slate-400 uppercase text-xs tracking-wider">Backlog</h3>
                    <Badge variant="secondary" className="text-xs">{backlogTasks.length} issues</Badge>
                </div>

                <div className="bg-slate-950/30 rounded-lg p-1 min-h-[200px]">
                    {backlogTasks.map(task => (
                        <BacklogTaskRow
                            key={task.id}
                            task={task}
                            sprints={sprints}
                            onMoveTask={handleMoveTask}
                        />
                    ))}
                    {backlogTasks.length === 0 && (
                        <div className="text-center p-8 text-slate-600 text-sm border-2 border-dashed border-slate-800 rounded-lg">
                            Your backlog is empty. Create a task!
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}