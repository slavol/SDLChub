"use client";

import { CreateTaskDialog } from "@/components/dashboard/create-task-dialog";
import { useState, useEffect } from "react";
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
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, Loader2, CheckCircle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Importam serviciile
import { getMyProjects } from "@/services/project";
import { getProjectTasks, updateTask, Task, TaskStatus, TaskPriority } from "@/services/task";
import { completeSprint } from "@/services/sprint"; // <--- Import nou

// --- COMPONENTA: TASK CARD ---
function TaskCard({ task, isOverlay }: { task: Task; isOverlay?: boolean }) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: "Task",
      task,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityColor = {
    [TaskPriority.CRITICAL]: "text-red-500 bg-red-500/20 border-red-500/40",
    [TaskPriority.HIGH]: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    [TaskPriority.MEDIUM]: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    [TaskPriority.LOW]: "text-slate-400 bg-slate-400/10 border-slate-400/20"
  };

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="opacity-30 bg-slate-800 h-[120px] rounded-lg border-2 border-dashed border-slate-600"
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
        "bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-sm hover:border-slate-600 group transition-all cursor-grab active:cursor-grabbing",
        isOverlay ? "rotate-2 scale-105 shadow-xl border-blue-500 cursor-grabbing z-50" : ""
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", priorityColor[task.priority])}>
          {task.priority}
        </Badge>
        <span className="text-[10px] text-slate-500 font-mono">{task.key}</span>
      </div>

      <h4 className="text-sm font-medium text-slate-200 mb-3 leading-snug">{task.title}</h4>

      <div className="flex justify-between items-center mt-auto">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {task.story_points && <Badge variant="secondary" className="bg-slate-800 text-slate-400 hover:bg-slate-700 h-5 px-1.5">{task.story_points} pts</Badge>}
        </div>
        {task.assignee_id && (
          <Avatar className="h-6 w-6 border border-slate-700">
            <AvatarFallback className="text-[10px] bg-blue-900 text-blue-200">
              U
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  );
}

// --- COMPONENTA: COLUMN ---
function BoardColumn({ id, title, tasks, color }: { id: TaskStatus; title: string; tasks: Task[]; color: string }) {
  const { setNodeRef } = useSortable({
    id: id,
    data: { type: "Column", id },
  });

  return (
    <div ref={setNodeRef} className="flex flex-col h-full min-w-[300px] w-[300px] bg-slate-950/50 rounded-xl border border-slate-800/50">
      <div className="p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", color)}></div>
          <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wide">{title}</h3>
          <Badge variant="secondary" className="ml-1 bg-slate-800 text-slate-400">{tasks.length}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-white">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-3 overflow-y-auto min-h-[150px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

// --- COLUMNS CONFIG ---
const COLUMNS_CONFIG = [
  { id: TaskStatus.TODO, title: "To Do", color: "bg-slate-500" },
  { id: TaskStatus.IN_PROGRESS, title: "In Progress", color: "bg-blue-500" },
  { id: TaskStatus.REVIEW, title: "Code Review", color: "bg-purple-500" },
  { id: TaskStatus.DONE, title: "Done", color: "bg-green-500" },
];

// --- MAIN PAGE ---
export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  
  // State pentru ID-ul sprintului activ (daca exista)
  const [activeSprintId, setActiveSprintId] = useState<number | null>(null);
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const init = async () => {
      try {
        const projects = await getMyProjects();
        if (projects.length > 0) {
          const pid = projects[0].id;
          setProjectId(pid);

          // Încărcăm Task-urile
          // Backend-ul filtreaza deja: daca e Scrum, aduce doar active sprint
          const remoteTasks = await getProjectTasks(pid);
          setTasks(remoteTasks);

          // Detectăm dacă suntem într-un sprint activ bazat pe task-uri
          // (Backend-ul trimite task-urile cu sprint_id populat daca e Scrum Active Sprint)
          const taskInSprint = remoteTasks.find(t => t.sprint_id);
          if (taskInSprint && taskInSprint.sprint_id) {
             setActiveSprintId(taskInSprint.sprint_id);
          }
        }
      } catch (e) {
        toast.error("Failed to load board data");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // --- LOGICA COMPLETE SPRINT ---
  const handleCompleteSprint = async () => {
    if (!activeSprintId) return;

    // Confirmare simpla
    if (!window.confirm("Are you sure you want to complete this sprint? Unfinished tasks will move to Backlog.")) {
        return;
    }

    try {
        await completeSprint(activeSprintId);
        toast.success("Sprint Completed Successfully!");
        
        // Golim board-ul si resetam sprint ID (pentru ca sprintul s-a inchis)
        setTasks([]);
        setActiveSprintId(null);
    } catch (error: any) {
        console.error(error);
        toast.error(error.response?.data?.detail || "Failed to complete sprint");
    }
  };

  // --- LOGICA DRAG & DROP ---
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === "Task") {
      setActiveTask(active.data.current.task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = active.id;
    const overId = over.id;
    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === "Task";
    const isOverTask = over.data.current?.type === "Task";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveTask) return;

    if (isActiveTask && isOverTask) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const overIndex = tasks.findIndex((t) => t.id === overId);
        if (tasks[activeIndex].status !== tasks[overIndex].status) {
          tasks[activeIndex].status = tasks[overIndex].status;
        }
        return arrayMove(tasks, activeIndex, overIndex);
      });
    }

    if (isActiveTask && isOverColumn) {
      setTasks((tasks) => {
        const activeIndex = tasks.findIndex((t) => t.id === activeId);
        const newStatus = overId as TaskStatus;
        if (tasks[activeIndex].status !== newStatus) {
          const newTasks = [...tasks];
          newTasks[activeIndex] = { ...newTasks[activeIndex], status: newStatus };
          return arrayMove(newTasks, activeIndex, activeIndex);
        }
        return tasks;
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
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
      } catch (e) {
        toast.error("Failed to save move");
      }
    }
  };

  if (!isMounted) return null;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-50">

      {/* Header */}
      <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Active Sprint
            {activeSprintId && (
                <Badge className="bg-green-500/10 text-green-400 border-green-500/20 ml-2">
                    Running
                </Badge>
            )}
          </h1>
        </div>
        <div className="flex gap-3">
            {/* BUTON COMPLETE SPRINT - Apare doar daca avem Sprint Activ */}
            {activeSprintId && (
                <Button 
                    variant="destructive" 
                    className="bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50"
                    onClick={handleCompleteSprint}
                >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Complete Sprint
                </Button>
            )}

          <Button variant="outline" className="border-slate-700 text-slate-300">Filters</Button>

          {projectId && (
            <CreateTaskDialog
              projectId={projectId}
              onTaskCreated={(newTask) => setTasks([...tasks, newTask])}
            />
          )}
        </div>
      </div>

      {/* Board Content */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
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
                  tasks={tasks.filter(t => t.status === col.id)}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}