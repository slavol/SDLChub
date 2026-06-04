import api from "@/lib/axios";
import { dedupeRequest } from "@/lib/request-dedupe";

export interface NgrokTunnelStatus {
  running: boolean;
  public_url?: string | null;
  webhook_url?: string | null;
  message: string;
  tunnels?: unknown[];
}

export interface GitHubIntegration {
  id?: number | null;
  project_id: number;
  configured: boolean;
  repository_full_name?: string | null;
  repository_url?: string | null;
  default_branch?: string | null;
  webhook_url?: string | null;
  webhook_endpoint_path: string;
  setup_status: "NOT_CONFIGURED" | "CONFIGURED" | "WAITING_FOR_PING" | "CONNECTED" | "ERROR" | string;
  auto_link_commits: boolean;
  auto_transition_prs: boolean;
  secret_configured: boolean;
  webhook_secret_hint?: string | null;
  last_ping_at?: string | null;
  last_delivery_at?: string | null;
  last_error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface GitHubIntegrationUpsert {
  repository_full_name: string;
  repository_url?: string | null;
  default_branch?: string | null;
  webhook_url?: string | null;
  auto_link_commits: boolean;
  auto_transition_prs: boolean;
}

export interface GitHubIntegrationTestResult {
  configured: boolean;
  secret_configured: boolean;
  status: string;
  message: string;
  repository_full_name?: string | null;
  webhook_url?: string | null;
  last_ping_at?: string | null;
  last_delivery_at?: string | null;
}

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
  return dedupeRequest(`github:events:project:${projectId}:${eventType || "all"}:${limit}`, async () => {
    const response = await api.get(`/github/events/project/${projectId}`, {
      params: {
        event_type: eventType || undefined,
        limit,
      },
    });

    return response.data;
  });
};

export const getTaskGitHubEvents = async (
  taskId: number,
  limit = 80
): Promise<GitHubEventItem[]> => {
  return dedupeRequest(`github:events:task:${taskId}:${limit}`, async () => {
    const response = await api.get(`/github/events/task/${taskId}`, {
      params: { limit },
    });

    return response.data;
  });
};

export const getProjectPullRequests = async (
  projectId: number,
  limit = 120
): Promise<GitHubPullRequestItem[]> => {
  return dedupeRequest(`github:pull-requests:${projectId}:${limit}`, async () => {
    const response = await api.get(`/github/pull-requests/project/${projectId}`, {
      params: { limit },
    });

    return response.data;
  });
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


export const getProjectGitHubIntegration = async (
  projectId: number
): Promise<GitHubIntegration> => {
  return dedupeRequest(`github:integration:${projectId}`, async () => {
    const response = await api.get(`/github/integration/project/${projectId}`);
    return response.data;
  });
};

export const upsertProjectGitHubIntegration = async (
  projectId: number,
  data: GitHubIntegrationUpsert
): Promise<GitHubIntegration> => {
  const response = await api.put(`/github/integration/project/${projectId}`, data);
  return response.data;
};

export const testProjectGitHubIntegration = async (
  projectId: number
): Promise<GitHubIntegrationTestResult> => {
  const response = await api.post(`/github/integration/project/${projectId}/test`);
  return response.data;
};

export const deleteProjectGitHubIntegration = async (
  projectId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/github/integration/project/${projectId}`);
  return response.data;
};


export const getNgrokTunnelStatus = async (): Promise<NgrokTunnelStatus> => {
  return dedupeRequest("github:ngrok:status", async () => {
    const response = await api.get("/github/ngrok/status");
    return response.data;
  });
};

export const startNgrokTunnel = async (
  port = 8000,
  projectId?: number
): Promise<NgrokTunnelStatus> => {
  const response = await api.post("/github/ngrok/start", null, {
    params: { port, project_id: projectId },
  });
  return response.data;
};

export const stopNgrokTunnel = async (
  projectId?: number
): Promise<NgrokTunnelStatus> => {
  const response = await api.post("/github/ngrok/stop", null, {
    params: { project_id: projectId },
  });
  return response.data;
};
