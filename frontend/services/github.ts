import api from "@/lib/axios";

export interface GitHubEventItem {
  id: number;
  delivery_id?: string | null;
  project_id?: number | null;
  task_id?: number | null;
  event_type: string;
  action?: string | null;
  repository?: string | null;
  sender_login?: string | null;
  task_key?: string | null;
  commit_sha?: string | null;
  pull_request_number?: number | null;
  url?: string | null;
  summary?: string | null;
  created_at: string;
}

export const getProjectGitHubEvents = async (
  projectId: number,
  eventType?: string | null,
  limit = 100
): Promise<GitHubEventItem[]> => {
  const response = await api.get(`/github/events/project/${projectId}`, {
    params: {
      event_type: eventType || undefined,
      limit,
    },
  });

  return response.data;
};
