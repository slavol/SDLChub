import api from "@/lib/axios";

export interface Sprint {
    id: number;
    project_id: number;
    name: string;
    goal?: string | null;
    is_active: boolean;
    start_date?: string | null;
    end_date?: string | null;
}

export interface CreateSprintDto {
    name: string;
    goal?: string | null;
    start_date?: string | null;
    end_date?: string | null;
}

export const getProjectSprints = async (projectId: number): Promise<Sprint[]> => {
    const response = await api.get(`/sprints/project/${projectId}`);
    return response.data;
};

export const createSprint = async (projectId: number, data: string | CreateSprintDto): Promise<Sprint> => {
    const payload = typeof data === "string"
        ? { name: data, project_id: projectId }
        : { ...data, project_id: projectId };

    const response = await api.post("/sprints/", {
        ...payload,
    });
    return response.data;
};

export const startSprint = async (sprintId: number): Promise<{ message: string; sprint: string }> => {
    const response = await api.post(`/sprints/${sprintId}/start`);
    return response.data;
};

export const completeSprint = async (sprintId: number): Promise<{ message: string; sprint: string }> => {
    const response = await api.post(`/sprints/${sprintId}/complete`);
    return response.data;
};
