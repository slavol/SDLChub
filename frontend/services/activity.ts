import api from "@/lib/axios";

export interface ProjectActivity {
  id: number;
  task_id: number;
  task_key: string;
  task_title: string;
  actor_id?: number | null;
  actor_name?: string | null;
  actor_avatar_url?: string | null;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface ProjectActivityFilters {
  limit?: number;
  hours?: number;
  actor_id?: number;
  action?: string;
}

export const getProjectActivity = async (
  projectId: number,
  filters: ProjectActivityFilters = {}
): Promise<ProjectActivity[]> => {
  const response = await api.get(`/projects/${projectId}/activity`, {
    params: filters,
  });

  return response.data;
};
