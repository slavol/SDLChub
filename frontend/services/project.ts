import api from "@/lib/axios";

// Tipuri pentru AI
export interface AIAnalysisRequest {
  team_size: string;
  work_nature: string;
  volatility: string;
  experience: string;
  metrics: string;
}

export interface AIAnalysisResponse {
  recommended: "SCRUM" | "KANBAN" | "SCRUMBAN";
  confidence_score: number;
  reasoning: string;
  pros: string[];
  cons: string[];
}

// 1. Cere recomandare de la AI
export const analyzeProjectNeeds = async (data: AIAnalysisRequest) => {
  const response = await api.post("/projects/ai-recommend", data);
  return response.data as AIAnalysisResponse;
};

// 2. Crează Workspace (Pasul 1 din fluxul final)
export const createWorkspace = async (name: string) => {
    const response = await api.post("/workspaces/", { name });
    return response.data; // Returnează obiectul Workspace cu ID
};

// 3. Crează Proiect (Pasul 2 din fluxul final)
export const createProject = async (workspaceId: number, projectData: any) => {
    const response = await api.post(`/projects/${workspaceId}`, projectData);
    return response.data;
};