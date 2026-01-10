import api from "@/lib/axios";

// --- TIPURI ---
export interface Project {
    id: number;
    name: string;
    key: string;
    methodology: string;
    owner_id: number;
}

export interface AIRecommendationRequest {
    team_size: string;
    work_nature: string;
    volatility: string;
    experience: string;
    metrics: string;
}

export interface AIRecommendationResponse {
    recommended: string;
    confidence_score: number;
    reasoning: string;
    pros: string[];
    cons: string[];
}

export interface AIRolesRequest {
    methodology: string;
    description: string;
}

export interface RoleSuggestion {
    name: string;
    description: string;
}

export interface RoleInput {
    name: string;
    description: string;
    emails: string[]; // Lista de email-uri ca string-uri simple
}

export interface CreateProjectRequest {
    name: string;
    key: string;
    description: string;
    methodology: string;
    roles: RoleInput[];
}

// --- API CALLS ---

export const getMyProjects = async (): Promise<Project[]> => {
    const response = await api.get("/projects/mine");
    return response.data;
};

export const joinProject = async (code: string) => {
    const response = await api.post("/projects/join", { code });
    return response.data;
};

// 1. Pasul de Recomandare Metodologie
export const getAIRecommendation = async (data: AIRecommendationRequest): Promise<AIRecommendationResponse> => {
    const response = await api.post("/projects/ai-recommend", data);
    return response.data;
};

// 2. Pasul de Sugestie Roluri
export const getAIRoles = async (data: AIRolesRequest): Promise<{ roles: RoleSuggestion[] }> => {
    const response = await api.post("/projects/ai-roles", data);
    return response.data;
};

// 3. Pasul Final de Creare
export const createProjectFull = async (data: CreateProjectRequest) => {
    const response = await api.post("/projects/create_full", data);
    return response.data;
};

export interface ProjectMember {
    id: number;
    email: string;
    full_name: string;
}

export const getProjectMembers = async (projectId: number): Promise<ProjectMember[]> => {
    const response = await api.get(`/projects/${projectId}/members`);
    return response.data;
};