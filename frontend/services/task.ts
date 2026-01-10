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
    story_points?: number;
    assignee_id?: number;
    project_id: number;
    sprint_id?: number | null;
}

export interface CreateTaskDto {
    title: string;
    description?: string;
    priority?: TaskPriority;
    project_id: number;
    assignee_id?: number;
}

// --- API CALLS ---

export const getProjectTasks = async (projectId: number): Promise<Task[]> => {
    const response = await api.get(`/tasks/project/${projectId}`);
    return response.data;
};

export const createTask = async (data: CreateTaskDto): Promise<Task> => {
    const response = await api.post("/tasks/", data);
    return response.data;
};

export const updateTask = async (taskId: number, updates: Partial<Task>): Promise<Task> => {
    const response = await api.put(`/tasks/${taskId}`, updates);
    return response.data;
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