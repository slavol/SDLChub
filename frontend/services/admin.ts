import api from "@/lib/axios";

export interface AdminOverview {
  users: number;
  projects: number;
  tasks: number;
  open_tickets: number;
  errors_last_24h: number;
  ai_configured: boolean;
  ai_requests: number;
  ai_requests_24h: number;
}

export interface AdminProject {
  id: number;
  name: string;
  key: string;
  methodology: string;
  is_archived: boolean;
  owner_name?: string | null;
  owner_email?: string | null;
  members_count: number;
  tasks_count: number;
  created_at?: string | null;
}

export interface SupportTicket {
  id: number;
  reporter_id?: number | null;
  reporter_email?: string | null;
  reporter_name?: string | null;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  comments_count: number;
  comments?: SupportTicketComment[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface SupportTicketComment {
  id: number;
  ticket_id: number;
  author_id?: number | null;
  author_name?: string | null;
  author_email?: string | null;
  body: string;
  is_admin_note: boolean;
  created_at?: string | null;
}

export interface HttpErrorLog {
  id: number;
  method: string;
  path: string;
  status_code: number;
  user_id?: number | null;
  user_name?: string | null;
  detail?: string | null;
  created_at?: string | null;
}

export interface AdminUser {
  id: number;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_global_admin: boolean;
  projects_count: number;
  owned_projects_count: number;
  assigned_tasks_count: number;
}

export interface AiUsageLog {
  id: number;
  user_id?: number | null;
  user_name?: string | null;
  project_id?: number | null;
  project_name?: string | null;
  feature: string;
  provider: string;
  source?: string | null;
  status: string;
  detail?: string | null;
  created_at?: string | null;
}

export const getAdminOverview = async (): Promise<AdminOverview> => {
  const response = await api.get("/admin/overview");
  return response.data;
};

export const getAdminProjects = async (): Promise<AdminProject[]> => {
  const response = await api.get("/admin/projects");
  return response.data;
};

export const getAdminTickets = async (): Promise<SupportTicket[]> => {
  const response = await api.get("/admin/tickets");
  return response.data;
};

export const getMySupportTickets = async (): Promise<SupportTicket[]> => {
  const response = await api.get("/admin/tickets/mine");
  return response.data;
};

export const getSupportTicket = async (
  ticketId: number
): Promise<SupportTicket> => {
  const response = await api.get(`/admin/tickets/${ticketId}`);
  return response.data;
};

export const getAdminErrors = async (): Promise<HttpErrorLog[]> => {
  const response = await api.get("/admin/errors");
  return response.data;
};

export const getAdminUsers = async (): Promise<AdminUser[]> => {
  const response = await api.get("/admin/users");
  return response.data;
};

export const getAdminAiUsage = async (): Promise<AiUsageLog[]> => {
  const response = await api.get("/admin/ai-usage");
  return response.data;
};

export const downloadAdminCsv = async (
  kind: "projects" | "users" | "ai-usage"
): Promise<void> => {
  const response = await api.get(`/admin/export/${kind}.csv`, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sdlc-hub-${kind}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export const updateAdminUser = async (
  userId: number,
  data: { is_active?: boolean; is_global_admin?: boolean }
): Promise<AdminUser> => {
  const response = await api.put(`/admin/users/${userId}`, data);
  return response.data;
};

export const updateAdminProjectArchive = async (
  projectId: number,
  isArchived: boolean
): Promise<AdminProject> => {
  const response = await api.put(`/admin/projects/${projectId}/archive`, {
    is_archived: isArchived,
  });
  return response.data;
};

export const deleteAdminProject = async (
  projectId: number,
  confirmationKey: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/admin/projects/${projectId}`, {
    data: { confirmation_key: confirmationKey },
  });
  return response.data;
};

export const updateAdminTicket = async (
  ticketId: number,
  data: { status?: string; priority?: string }
): Promise<SupportTicket> => {
  const response = await api.put(`/admin/tickets/${ticketId}`, data);
  return response.data;
};

export const createSupportTicket = async (data: {
  title: string;
  description?: string;
  priority?: string;
}): Promise<SupportTicket> => {
  const response = await api.post("/admin/tickets", data);
  return response.data;
};

export const createSupportTicketComment = async (
  ticketId: number,
  body: string
): Promise<SupportTicketComment> => {
  const response = await api.post(`/admin/tickets/${ticketId}/comments`, {
    body,
  });
  return response.data;
};

export const deleteSupportTicket = async (
  ticketId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/admin/tickets/${ticketId}`);
  return response.data;
};

export const deleteSupportTicketComment = async (
  ticketId: number,
  commentId: number
): Promise<{ message: string }> => {
  const response = await api.delete(
    `/admin/tickets/${ticketId}/comments/${commentId}`
  );
  return response.data;
};
