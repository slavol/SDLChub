import api from "@/lib/axios";

export interface GitHubEventItem {
  id: number;
  delivery_id?: string | null;
  project_id?: number | null;
  task_id?: number | null;
  mapped_user_id?: number | null;
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

export interface GitHubPullRequestItem {
  id: number;
  project_id?: number | null;
  task_id?: number | null;
  task_key?: string | null;
  task_title?: string | null;
  task_status?: string | null;
  action?: string | null;
  repository?: string | null;
  sender_login?: string | null;
  mapped_user_id?: number | null;
  mapped_user_name?: string | null;
  mapped_user_email?: string | null;
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

export const getProjectPullRequests = async (
  projectId: number,
  limit = 120
): Promise<GitHubPullRequestItem[]> => {
  const response = await api.get(`/github/pull-requests/project/${projectId}`, {
    params: { limit },
  });

  return response.data;
};

export const confirmPullRequestTransition = async (
  eventId: number,
  targetStatus: "REVIEW" | "DONE",
  note?: string
): Promise<GitHubPullRequestItem> => {
  const response = await api.post(`/github/pull-requests/${eventId}/confirm`, {
    target_status: targetStatus,
    note,
  });

  return response.data;
};
