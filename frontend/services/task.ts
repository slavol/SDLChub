import api from "@/lib/axios";

// Tipuri care se potrivesc cu Backend-ul (Pydantic schemas)
export enum TaskStatus {
    TODO = "TODO",
    IN_PROGRESS = "IN_PROGRESS",
    REVIEW = "REVIEW",
    DONE = "DONE"
}

export enum TaskPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}

export interface Task {
    id: number;
    key: string;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    story_points?: number | null;
    due_date?: string | null;
    assignee_id?: number;
    assignee_name?: string | null;
    project_id: number;
    sprint_id?: number | null;
    created_at?: string;
}

export interface Subtask {
    id: number;
    task_id: number;
    title: string;
    is_done: boolean;
    created_by_id?: number | null;
    created_by_name?: string | null;
    created_at: string;
}

export interface TaskComment {
    id: number;
    task_id: number;
    author_id: number;
    author_name?: string | null;
    body: string;
    created_at: string;
    updated_at?: string | null;
}

export interface TaskAuditLog {
    id: number;
    task_id: number;
    actor_id?: number | null;
    actor_name?: string | null;
    action: string;
    field?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    created_at: string;
}

export interface TaskDetail extends Task {
    subtasks: Subtask[];
    comments: TaskComment[];
    audit_logs: TaskAuditLog[];
}


export interface ProjectActivity {
    id: number;
    task_id: number;
    task_key: string;
    task_title: string;
    actor_id?: number | null;
    actor_name?: string | null;
    action: string;
    field?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    created_at: string;
}

export interface ProjectActivityFilters {
    limit?: number;
    hours?: number;
    actor_id?: number;
    action?: string;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    priority?: TaskPriority;
    story_points?: number | null;
    due_date?: string | null;
    project_id: number;
    assignee_id?: number;
    sprint_id?: number | null;
}

// --- API CALLS ---

export const getProjectTasks = async (projectId: number, view: "board" | "backlog" = "board"): Promise<Task[]> => {
    const response = await api.get(`/tasks/project/${projectId}`, {
        params: { view },
    });
    return response.data;
};

export const createTask = async (data: CreateTaskDto): Promise<Task> => {
    const response = await api.post("/tasks/", data);
    return response.data;
};

export const getTaskDetail = async (taskId: number): Promise<TaskDetail> => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
};

export const updateTask = async (taskId: number, updates: Partial<Task>): Promise<Task> => {
    const response = await api.put(`/tasks/${taskId}`, updates);
    return response.data;
};

export const createSubtask = async (taskId: number, title: string): Promise<Subtask> => {
    const response = await api.post(`/tasks/${taskId}/subtasks`, { title });
    return response.data;
};

export const updateSubtask = async (taskId: number, subtaskId: number, updates: Partial<Subtask>): Promise<Subtask> => {
    const response = await api.put(`/tasks/${taskId}/subtasks/${subtaskId}`, updates);
    return response.data;
};

export const createTaskComment = async (taskId: number, body: string): Promise<TaskComment> => {
    const response = await api.post(`/tasks/${taskId}/comments`, { body });
    return response.data;
};

export const updateTaskComment = async (taskId: number, commentId: number, body: string): Promise<TaskComment> => {
    const response = await api.put(`/tasks/${taskId}/comments/${commentId}`, { body });
    return response.data;
};

export const deleteTaskComment = async (taskId: number, commentId: number): Promise<void> => {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
};

export const generateTaskDescription = async (title: string, priority: string): Promise<string> => {
    // ATENȚIE AICI: URL-ul trebuie să fie /tasks/ai-generate
    const response = await api.post("/tasks/ai-generate", {
        title,
        priority,
        context: "Software Engineering Project"
    });
    return response.data.description;
};


export const getProjectActivity = async (
    projectId: number,
    filters: ProjectActivityFilters = {}
): Promise<ProjectActivity[]> => {
    const response = await api.get(`/tasks/project/${projectId}/activity`, {
        params: filters,
    });
    return response.data;
};
