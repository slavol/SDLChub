import api from "@/lib/axios";

export interface DocumentationPage {
  id: number;
  project_id: number;
  task_id?: number | null;
  title: string;
  content: string;
  created_by_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentationRevision {
  id: number;
  page_id: number;
  project_id: number;
  task_id?: number | null;
  title: string;
  content: string;
  action: string;
  actor_id?: number | null;
  created_at: string;
}

export interface DocumentationPageCreate {
  title: string;
  content: string;
  task_id?: number | null;
}

export interface DocumentationPageUpdate {
  title?: string;
  content?: string;
  task_id?: number | null;
}

export const getProjectDocumentationPages = async (
  projectId: number
): Promise<DocumentationPage[]> => {
  const response = await api.get(`/documentation/project/${projectId}`);
  return response.data;
};

export const createDocumentationPage = async (
  projectId: number,
  data: DocumentationPageCreate
): Promise<DocumentationPage> => {
  const response = await api.post(`/documentation/project/${projectId}`, data);
  return response.data;
};

export const updateDocumentationPage = async (
  pageId: number,
  data: DocumentationPageUpdate
): Promise<DocumentationPage> => {
  const response = await api.put(`/documentation/${pageId}`, data);
  return response.data;
};

export const getDocumentationPageHistory = async (
  pageId: number
): Promise<DocumentationRevision[]> => {
  const response = await api.get(`/documentation/${pageId}/history`);
  return response.data;
};

export const deleteDocumentationPage = async (pageId: number): Promise<void> => {
  await api.delete(`/documentation/${pageId}`);
};

export const generateDocumentationFromTask = async (
  taskId: number
): Promise<DocumentationPage> => {
  const response = await api.post(`/documentation/from-task/${taskId}`);
  return response.data;
};
