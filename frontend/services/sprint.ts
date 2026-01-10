import api from "@/lib/axios";

export interface Sprint {
    id: number;
    name: string;
    goal?: string;
    status: "active" | "future" | "closed"; // Sau cum le-ai definit in DB (boolean is_active)
    is_active: boolean;
    start_date?: string;
    end_date?: string;
}

export const getProjectSprints = async (projectId: number): Promise<Sprint[]> => {
    const response = await api.get(`/sprints/project/${projectId}`);
    return response.data;
};

export const createSprint = async (projectId: number, name: string): Promise<Sprint> => {
    const response = await api.post("/sprints/", {
        name,
        project_id: projectId
    });
    return response.data;
};

export const startSprint = async (sprintId: number): Promise<any> => {
    const response = await api.post(`/sprints/${sprintId}/start`);
    return response.data;
};

export const completeSprint = async (sprintId: number): Promise<any> => {
    const response = await api.post(`/sprints/${sprintId}/complete`);
    return response.data;
};