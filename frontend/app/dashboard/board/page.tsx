"use client";

// 1. React & Next Imports
import { useCallback, useState, useEffect } from "react";
import Link from "next/link";

// 2. Third-Party Libraries (DnD Kit, Icons, etc.)
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ExternalLink,
  AlertTriangle,
  BarChart3,
  Loader2,
  CalendarClock,
  CheckCircle,
  CircleDot,
  Gauge,
  GripVertical,
  KanbanSquare,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

// 3. UI Components
import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import { cn } from "@/lib/utils";

// 4. Services, Store & Types
import { getMyProjects, getProjectDetail } from "@/services/project";
import { getProjectTasks, updateTask, Task, TaskStatus, TaskPriority } from "@/services/task";
import { completeSprint, getProjectSprints } from "@/services/sprint";
import { getApiErrorMessage } from "@/lib/api-error";
import { useProjectStore } from "@/store/use-project-store";
import type { Project } from "@/services/project";

// ==========================================
// CONSTANTS & HELPERS
// ==========================================

const COLUMNS_CONFIG = [
  { id: TaskStatus.TODO, title: "To Do", color: "bg-slate-500" },
  { id: TaskStatus.IN_PROGRESS, title: "In Progress", color: "bg-blue-500" },
  { id: TaskStatus.REVIEW, title: "Code Review", color: "bg-purple-500" },
  { id: TaskStatus.DONE, title: "Done", color: "bg-green-500" },
];

const priorityColor = {
  [TaskPriority.CRITICAL]: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  [TaskPriority.HIGH]: "text-orange-300 bg-orange-500/10 border-orange-500/25",
  [TaskPriority.MEDIUM]: "text-blue-300 bg-blue-500/10 border-blue-500/25",
  [TaskPriority.LOW]: "text-slate-300 bg-slate-800/80 border-slate-700",
};

const priorityStripe = {
  [TaskPriority.CRITICAL]: "bg-rose-500",
  [TaskPriority.HIGH]: "bg-orange-500",
  [TaskPriority.MEDIUM]: "bg-blue-500",
  [TaskPriority.LOW]: "bg-slate-500",
};

function formatTaskDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function projectSnapshotChanged(current: Project | null, next: Project) {
  if (!current) return true;

  return (
    current.id !== next.id ||
    current.name !== next.name ||
    current.key !== next.key ||
    current.methodology !== next.methodology ||
    current.description !== next.description ||
    JSON.stringify(current.workflow_config || null) !==
      JSON.stringify(next.workflow_config || null)
  );
}

// ==========================================
// COMPONENT: TASK CARD
// ==========================================

function TaskCard({
  task,
  isOverlay,
  showStoryPoints = true,
}: {
  task: Task;
  isOverlay?: boolean;
  showStoryPoints?: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "Task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assigneeInitials = (task.assignee_name || "Unassigned")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dueDate = formatTaskDate(task.due_date);

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[154px] rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 opacity-40"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/90 p-4 shadow-sm transition-all cursor-grab active:cursor-grabbing",
        "hover:-translate-y-0.5 hover:border-blue-500/35 hover:bg-slate-900 hover:shadow-lg hover:shadow-slate-950/25",
        isOverlay && "rotate-2 scale-105 border-blue-500 shadow-2xl shadow-blue-950/30 cursor-grabbing z-50"
      )}
    >
      {/* Indicator prioritate (Linie laterală) */}
      <div className={cn("absolute left-0 top-0 h-full w-1", priorityStripe[task.priority])} />

      {/* Header Task (Key, Priority, Actions) */}
      <div className="mb-3 flex items-start justify-between gap-3 pl-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-md border-slate-700 bg-slate-950 font-mono text-[10px] text-slate-300">
            {task.key}
          </Badge>
          <Badge variant="outline" className={cn("rounded-md border text-[10px]", priorityColor[task.priority])}>
            {task.priority}
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GripVertical className="h-4 w-4 text-slate-700 transition group-hover:text-slate-500" />
          <Link
            href={`/dashboard/tasks/${task.id}`}
            onPointerDown={(event) => event.stopPropagation()}
            className="rounded-md p-1 text-slate-500 opacity-0 transition hover:bg-slate-800 hover:text-blue-300 group-hover:opacity-100"
            aria-label={`Open ${task.key}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Titlu Task */}
      <h4 className="mb-4 line-clamp-3 pl-1 text-sm font-semibold leading-6 text-slate-100">
        {task.title}
      </h4>

      {/* Footer Task (Estimări, Assignee, Dată) */}
      <div className="mt-auto flex items-center justify-between gap-3 pl-1">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          {showStoryPoints && (
            <Badge variant="secondary" className="h-6 rounded-md bg-slate-800 px-2 text-xs text-slate-300 hover:bg-slate-800">
              {task.story_points ? `${task.story_points} pts` : "No est."}
            </Badge>
          )}

          {!task.assignee_id && (
            <span className="hidden items-center gap-1 text-slate-600 sm:flex">
              <UserRound className="h-3.5 w-3.5" />
              Unassigned
            </span>
          )}

          {dueDate && (
            <span className="hidden items-center gap-1 text-slate-500 sm:flex">
              <CalendarClock className="h-3.5 w-3.5" />
              {dueDate}
            </span>
          )}
        </div>

        <UserAvatar
          name={task.assignee_name || (task.assignee_id ? assigneeInitials : "Not assigned")}
          src={task.assignee_avatar_url}
          className="h-7 w-7"
          fallbackClassName={cn(
            "text-[10px] font-bold",
            task.assignee_id ? "bg-blue-500/15 text-blue-200" : "bg-slate-800 text-slate-500"
          )}
        />
      </div>
    </div>
  );
}

// ==========================================
// COMPONENT: BOARD COLUMN
// ==========================================

function BoardColumn({
  id,
  title,
  tasks,
  color,
  showStoryPoints,
  wipLimit,
}: {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  color: string;
  showStoryPoints: boolean;
  wipLimit?: number | null;
}) {
  const { setNodeRef } = useSortable({
    id: id,
    data: { type: "Column", id },
  });

  const limitExceeded = typeof wipLimit === "number" && wipLimit > 0 && tasks.length > wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-w-[360px] w-[360px] flex-col rounded-lg border bg-slate-950/70 shadow-xl shadow-slate-950/20",
        limitExceeded ? "border-red-500/45" : "border-slate-800"
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 p-4">
        <div className="flex items-center gap-2">
          <div className={cn("h-2.5 w-2.5 rounded-full", color)} />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">{title}</h3>
          <Badge variant="secondary" className="ml-1 rounded-md bg-slate-800 text-slate-400 hover:bg-slate-800">
            {tasks.length}
          </Badge>
          {typeof wipLimit === "number" && wipLimit > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "rounded-md text-[10px]",
                limitExceeded
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-slate-700 bg-slate-900 text-slate-400"
              )}
            >
              WIP {tasks.length}/{wipLimit}
            </Badge>
          )}
        </div>
        {limitExceeded && <AlertTriangle className="h-4 w-4 text-red-300" />}
      </div>

      <div className="min-h-[180px] flex-1 overflow-y-auto p-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} showStoryPoints={showStoryPoints} />
            ))}

            {tasks.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/35 p-6 text-center">
                <CircleDot className="mx-auto mb-3 h-6 w-6 text-slate-700" />
                <p className="text-sm font-medium text-slate-500">No tasks here</p>
                <p className="mt-1 text-xs text-slate-600">Drop work into this lane.</p>
              </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// ==========================================
// MAIN PAGE COMPONENT
// ==========================================

export default function BoardPage() {
  const { currentProject, setCurrentProject } = useProjectStore();

  // State-uri
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [methodology, setMethodology] = useState<string>("SCRUM");
  const [wipLimits, setWipLimits] = useState<Record<string, number | null>>({});
  const [activeSprintId, setActiveSprintId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // State-uri pentru Modal-ul "Complete Sprint"
  const [completeSprintOpen, setCompleteSprintOpen] = useState(false);
  const [completingSprint, setCompletingSprint] = useState(false);
  const { can } = useProjectPermissions(projectId);
  const canCreateTask = can("TASK_CREATE");
  const canMoveTask = can("TASK_MOVE");
  const canCloseSprint = can("SPRINT_CLOSE");

  // Senzori DnD
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadBoard = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        let project = currentProject;

        if (!project) {
          const projects = await getMyProjects();
          project = projects[0] ?? null;
          if (project) setCurrentProject(project);
        }

        if (project) {
          const pid = project.id;
          setProjectId(pid);
          setMethodology(project.methodology);

          const [freshProject, remoteTasks, remoteSprints] = await Promise.all([
            getProjectDetail(pid),
            getProjectTasks(pid, "board"),
            getProjectSprints(pid),
          ]);

          if (projectSnapshotChanged(project, freshProject)) {
            setCurrentProject(freshProject);
          }
          setMethodology(freshProject.methodology);
          setWipLimits(freshProject.workflow_config?.wip_limits || {});
          setTasks(remoteTasks);
          const activeSprint = remoteSprints.find((sprint) => sprint.is_active);
          setActiveSprintId(activeSprint?.id ?? null);
        }
      } catch {
        toast.error("Failed to load board data");
      } finally {
        setLoading(false);
      }
    },
    [currentProject, setCurrentProject]
  );

  // Initializare Date
  useEffect(() => {
    setIsMounted(true);
    loadBoard();
  }, [loadBoard]);

  useRealtimeEvent((message) => {
    if (!projectId || (message.project_id && message.project_id !== projectId)) return;

    if (message.type === "task.changed" || message.type === "sprint.changed") {
      loadBoard(false);
    }
  }, [projectId, loadBoard]);

  // Handler: Complete Sprint
  const handleCompleteSprint = async () => {
    if (!activeSprintId) return;

    setCompletingSprint(true);
    try {
      await completeSprint(activeSprintId);
      toast.success("Sprint Completed Successfully!");

      setTasks([]);
      setActiveSprintId(null);
      setCompleteSprintOpen(false);
    } catch (error: unknown) {
      console.error(error);
      toast.error(getApiErrorMessage(error, "Failed to complete sprint"));
    } finally {
      setCompletingSprint(false);
    }
  };

  // Handler: Drag Start
  const handleDragStart = (event: DragStartEvent) => {
    if (!canMoveTask) return;

    const { active } = event;
    if (active.data.current?.type === "Task") {
      setActiveTask(active.data.current.task);
    }
  };

  // Handler: Drag Over
  const handleDragOver = (event: DragOverEvent) => {
    if (!canMoveTask) return;

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    // Mutare Task peste alt Task
    if (isActiveTask && isOverTask) {
      setTasks((currentTasks) => {
        const activeIndex = currentTasks.findIndex((task) => task.id === activeId);
        const overIndex = currentTasks.findIndex((task) => task.id === overId);

        if (activeIndex === -1 || overIndex === -1) return currentTasks;

        const nextTasks = [...currentTasks];
        const overStatus = nextTasks[overIndex].status;

        if (nextTasks[activeIndex].status !== overStatus) {
          nextTasks[activeIndex] = { ...nextTasks[activeIndex], status: overStatus };
        }

        return arrayMove(nextTasks, activeIndex, overIndex);
      });
    }

    // Mutare Task într-o Coloană nouă (goală)
    if (isActiveTask && isOverColumn) {
      setTasks((currentTasks) => {
        const activeIndex = currentTasks.findIndex((task) => task.id === activeId);
        if (activeIndex === -1) return currentTasks;

        const newStatus = overId as TaskStatus;
        if (currentTasks[activeIndex].status === newStatus) return currentTasks;

        const nextTasks = [...currentTasks];
        nextTasks[activeIndex] = { ...nextTasks[activeIndex], status: newStatus };

        return nextTasks;
      });
    }
  };

  // Handler: Drag End
  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canMoveTask) {
      setActiveTask(null);
      return;
    }

    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as number;
    const overData = over.data.current;

    let newStatus: TaskStatus | undefined;

    if (overData?.type === "Column") {
      newStatus = overData.id as TaskStatus;
    } else if (overData?.type === "Task") {
      newStatus = overData.task.status as TaskStatus;
    }

    if (newStatus) {
      try {
        await updateTask(activeId, { status: newStatus });
      } catch {
        toast.error("Failed to save move");
      }
    }
  };

  if (!isMounted) return null;

  // Calculare Statistici
  const isScrumLike = methodology === "SCRUM" || methodology === "SCRUMBAN";
  const supportsWipLimits = methodology === "KANBAN" || methodology === "SCRUMBAN";
  const activeTasks = tasks.filter((task) => task.status !== TaskStatus.DONE).length;
  const doneTasks = tasks.filter((task) => task.status === TaskStatus.DONE).length;
  const reviewTasks = tasks.filter((task) => task.status === TaskStatus.REVIEW).length;
  const inProgressTasks = tasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length;
  const wipAlerts = supportsWipLimits
    ? COLUMNS_CONFIG.filter((column) => {
        const limit = wipLimits[column.id];
        if (typeof limit !== "number" || limit <= 0) return false;
        return tasks.filter((task) => task.status === column.id).length > limit;
      }).length
    : 0;

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-50">
      
      {/* --- HEADER --- */}
      <div className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-6 py-5 backdrop-blur">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          
          {/* Titlu și Info */}
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="rounded-md bg-blue-600 text-white">
                {isScrumLike ? "Sprint board" : "Kanban board"}
              </Badge>
              {isScrumLike && activeSprintId && (
                <Badge className="rounded-md border-green-500/20 bg-green-500/10 text-green-400">
                  Running
                </Badge>
              )}
              {isScrumLike && !activeSprintId && (
                <Badge className="rounded-md border-slate-700 bg-slate-800 text-slate-400">
                  No active sprint
                </Badge>
              )}
              {supportsWipLimits && (
                <Badge
                  className={cn(
                    "rounded-md",
                    wipAlerts > 0
                      ? "border-red-500/30 bg-red-500/10 text-red-200"
                      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                  )}
                >
                  {wipAlerts > 0 ? `${wipAlerts} WIP alerts` : "Flow healthy"}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-200">
                <KanbanSquare className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  {isScrumLike ? "Active Sprint" : "Kanban Board"}
                </h1>
                <p className="mt-1 text-sm text-slate-400">
                  {isScrumLike
                    ? "Focused execution for the currently running sprint."
                    : "Continuous delivery flow with live WIP pressure."}
                </p>
              </div>
            </div>
          </div>

          {/* Statistici Board */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <BarChart3 className="h-4 w-4 text-blue-300" />
                <p className="text-xs">Active</p>
              </div>
              <p className="text-xl font-semibold text-white">{activeTasks}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <Gauge className="h-4 w-4 text-cyan-300" />
                <p className="text-xs">In progress</p>
              </div>
              <p className="text-xl font-semibold text-white">{inProgressTasks}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <CircleDot className="h-4 w-4 text-purple-300" />
                <p className="text-xs">Review</p>
              </div>
              <p className="text-xl font-semibold text-white">{reviewTasks}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-slate-500">
                <CheckCircle className="h-4 w-4 text-emerald-300" />
                <p className="text-xs">Done</p>
              </div>
              <p className="text-xl font-semibold text-white">{doneTasks}</p>
            </div>
          </div>
        </div>

        {/* Acțiuni (Butoane) */}
        <div className="mt-5 flex flex-wrap gap-3">
          {activeSprintId && canCloseSprint && (
            <Button
              variant="destructive"
              className="border border-red-900/50 bg-red-900/20 text-red-400 hover:bg-red-900/40"
              onClick={() => setCompleteSprintOpen(true)}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Complete Sprint
            </Button>
          )}

          {projectId && canCreateTask && (!isScrumLike || activeSprintId) && (
            <CreateTaskDialog
              projectId={projectId}
              sprintId={activeSprintId ?? undefined}
              methodology={methodology}
              onTaskCreated={(newTask) => setTasks([...tasks, newTask])}
            />
          )}
        </div>
      </div>

      {/* --- BOARD CONTENT --- */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-950 p-5">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-6">
              {COLUMNS_CONFIG.map((col) => (
                <BoardColumn
                  key={col.id}
                  id={col.id}
                  title={col.title}
                  color={col.color}
                  tasks={tasks.filter((t) => t.status === col.id)}
                  showStoryPoints={isScrumLike}
                  wipLimit={supportsWipLimits ? wipLimits[col.id] : null}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} isOverlay showStoryPoints={isScrumLike} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* --- DIALOGS --- */}
      <ConfirmDialog
        open={completeSprintOpen}
        onOpenChange={setCompleteSprintOpen}
        title="Complete sprint?"
        description="Unfinished tasks will be moved back to the backlog. Completed tasks will remain in this sprint history."
        confirmLabel="Complete Sprint"
        destructive
        loading={completingSprint}
        onConfirm={handleCompleteSprint}
      />
    </div>
  );
}
