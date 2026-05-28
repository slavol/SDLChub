import api from "@/lib/axios";

export type Methodology = "SCRUM" | "KANBAN" | "SCRUMBAN";

export interface Project {
  id: number;
  name: string;
  key: string;
  description?: string | null;
  methodology: Methodology | string;
  workflow_config?: ProjectWorkflowConfig | null;
  owner_id: number;
  created_at?: string;
  logo_url?: string | null;
}

export interface ProjectWorkflowConfig {
  wip_limits?: Record<string, number | null>;
}

export interface AIRecommendationRequest {
  team_size: string;
  work_nature: string;
  volatility: string;
  experience: string;
  metrics: string;
}

export interface AIRecommendationResponse {
  recommended: Methodology;
  confidence_score: number;
  reasoning: string;
  pros: string[];
  cons: string[];
}

export interface AIRolesRequest {
  methodology: Methodology | string;
  description: string;
}

export interface RoleSuggestion {
  name: string;
  description: string;
}

export interface RoleInput {
  name: string;
  description: string;
  emails: string[];
}

export interface CreateProjectRequest {
  name: string;
  key: string;
  description: string;
  methodology: Methodology | string;
  roles: RoleInput[];
}

export interface ProjectRole {
  id: number;
  name: string;
  description?: string | null;
  permissions?: Record<string, boolean>;
}

export interface ProjectTeam {
  id: number;
  project_id: number;
  parent_id?: number | null;
  name: string;
  description?: string | null;
  member_count: number;
  task_count: number;
  created_at: string;
  updated_at?: string | null;
}

export interface ProjectMember {
  membership_id: number;
  user: {
    id: number;
    email: string;
    full_name?: string | null;
    avatar_url?: string | null;
    is_active: boolean;
  };
  role?: ProjectRole | null;
  team?: ProjectTeam | null;
  joined_at: string;
}

export interface MyProjectPermissions {
  membership_id: number;
  role?: ProjectRole | null;
  permissions: Record<string, boolean>;
  is_project_owner: boolean;
  is_project_admin: boolean;
}

export interface PendingInvitation {
  id: number;
  email: string;
  project_id: number;
  project_name: string;
  role_id: number;
  role_name: string;
  code: string;
  status: string;
  created_at: string;
}

export interface OnboardingStatus {
  has_projects: boolean;
  has_pending_invites: boolean;
  projects: Project[];
}

export interface JoinProjectResponse {
  message: string;
  project?: Project;
}

export const getMyProjects = async (): Promise<Project[]> => {
  const response = await api.get("/projects/mine");
  return response.data;
};

export const getOnboardingStatus = async (): Promise<OnboardingStatus> => {
  const response = await api.get("/projects/onboarding/status");
  return response.data;
};

export const getPendingInvitations = async (): Promise<PendingInvitation[]> => {
  const response = await api.get("/projects/invitations/pending");
  return response.data;
};

export const joinProject = async (code: string): Promise<JoinProjectResponse> => {
  const response = await api.post("/projects/join", { code });
  return response.data;
};

export const getAIRecommendation = async (
  data: AIRecommendationRequest
): Promise<AIRecommendationResponse> => {
  const response = await api.post("/projects/ai-recommend", data);
  return response.data;
};

export const getAIRoles = async (
  data: AIRolesRequest
): Promise<{ roles: RoleSuggestion[] }> => {
  const response = await api.post("/projects/ai-roles", data);
  return response.data;
};

export const createProjectFull = async (
  data: CreateProjectRequest
): Promise<Project> => {
  const response = await api.post("/projects/create_full", data);
  return response.data;
};

export const getProjectMembers = async (
  projectId: number
): Promise<ProjectMember[]> => {
  const response = await api.get(`/projects/${projectId}/members`);
  return response.data;
};

export const getMyProjectPermissions = async (
  projectId: number
): Promise<MyProjectPermissions> => {
  const response = await api.get(`/projects/${projectId}/my-permissions`);
  return response.data;
};


// --- BATCH 6A TEAM SETTINGS PERMISSIONS ---

export interface ProjectRoleWithPermissions {
  id: number;
  project_id: number;
  name: string;
  description?: string | null;
  permissions: Record<string, boolean>;
}

export interface ProjectUpdateRequest {
  name?: string;
  description?: string | null;
  methodology?: Methodology | string;
}

export interface MethodologyTransitionPreview {
  current_methodology: Methodology | string;
  target_methodology: Methodology | string;
  recommended_strategy: string;
  can_apply: boolean;
  blockers: string[];
  warnings: string[];
  actions: string[];
  affected_counts: {
    total_tasks: number;
    backlog_tasks: number;
    sprint_tasks: number;
    active_sprint_tasks: number;
    unfinished_active_sprint_tasks: number;
    future_sprints: number;
    story_point_tasks: number;
  };
}

export interface MethodologyTransitionResult {
  project: Project;
  transition: MethodologyTransitionPreview;
  message: string;
}

export interface InviteProjectMemberRequest {
  email: string;
  role_id: number;
}

export const getProjectDetail = async (projectId: number): Promise<Project> => {
  const response = await api.get(`/projects/${projectId}`);
  return response.data;
};

export const updateProjectSettings = async (
  projectId: number,
  data: ProjectUpdateRequest
): Promise<Project> => {
  const response = await api.put(`/projects/${projectId}`, data);
  return response.data;
};

export const updateProjectWorkflow = async (
  projectId: number,
  data: ProjectWorkflowConfig
): Promise<Project> => {
  const response = await api.put(`/projects/${projectId}/workflow`, data);
  return response.data;
};

export const getMethodologyTransitionPreview = async (
  projectId: number,
  target: Methodology | string
): Promise<MethodologyTransitionPreview> => {
  const response = await api.get(`/projects/${projectId}/methodology-transition-preview`, {
    params: { target },
  });
  return response.data;
};

export const applyMethodologyTransition = async (
  projectId: number,
  targetMethodology: Methodology | string,
  strategy = "recommended"
): Promise<MethodologyTransitionResult> => {
  const response = await api.post(`/projects/${projectId}/methodology-transition`, {
    target_methodology: targetMethodology,
    strategy,
  });
  return response.data;
};

export const deleteProject = async (
  projectId: number,
  confirmationKey: string
): Promise<{ message: string }> => {
  const response = await api.delete(`/projects/${projectId}`, {
    data: { confirmation_key: confirmationKey },
  });
  return response.data;
};

export const getProjectRoles = async (
  projectId: number
): Promise<ProjectRoleWithPermissions[]> => {
  const response = await api.get(`/projects/${projectId}/roles`);
  return response.data;
};

export const updateRolePermissions = async (
  projectId: number,
  roleId: number,
  permissions: Record<string, boolean>
): Promise<ProjectRoleWithPermissions> => {
  const response = await api.put(`/projects/${projectId}/roles/${roleId}/permissions`, {
    permissions,
  });
  return response.data;
};

export const getProjectInvitations = async (
  projectId: number
): Promise<PendingInvitation[]> => {
  const response = await api.get(`/projects/${projectId}/invitations`);
  return response.data;
};

export const inviteProjectMember = async (
  projectId: number,
  data: InviteProjectMemberRequest
): Promise<PendingInvitation> => {
  const response = await api.post(`/projects/${projectId}/invitations`, data);
  return response.data;
};

export const resendProjectInvitation = async (
  projectId: number,
  invitationId: number
): Promise<{ message: string }> => {
  const response = await api.post(`/projects/${projectId}/invitations/${invitationId}/resend`);
  return response.data;
};

export const cancelProjectInvitation = async (
  projectId: number,
  invitationId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/projects/${projectId}/invitations/${invitationId}`);
  return response.data;
};

export const updateProjectMemberRole = async (
  projectId: number,
  membershipId: number,
  roleId: number
): Promise<ProjectMember> => {
  const response = await api.put(`/projects/${projectId}/members/${membershipId}/role`, {
    role_id: roleId,
  });
  return response.data;
};

export const removeProjectMember = async (
  projectId: number,
  membershipId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/projects/${projectId}/members/${membershipId}`);
  return response.data;
};

export interface ProjectTeamPayload {
  name: string;
  description?: string | null;
  parent_id?: number | null;
}

export const getProjectTeams = async (
  projectId: number
): Promise<ProjectTeam[]> => {
  const response = await api.get(`/teams/project/${projectId}`);
  return response.data;
};

export const createProjectTeam = async (
  projectId: number,
  data: ProjectTeamPayload
): Promise<ProjectTeam> => {
  const response = await api.post(`/teams/project/${projectId}`, data);
  return response.data;
};

export const updateProjectTeam = async (
  teamId: number,
  data: Partial<ProjectTeamPayload>
): Promise<ProjectTeam> => {
  const response = await api.put(`/teams/${teamId}`, data);
  return response.data;
};

export const deleteProjectTeam = async (teamId: number): Promise<{ message: string }> => {
  const response = await api.delete(`/teams/${teamId}`);
  return response.data;
};

export const updateProjectMemberTeam = async (
  projectId: number,
  membershipId: number,
  teamId?: number | null
): Promise<{ membership_id: number; team_id?: number | null }> => {
  const response = await api.put(`/teams/project/${projectId}/members/${membershipId}`, {
    team_id: teamId || null,
  });
  return response.data;
};



// --- BATCH 6B ROLE CRUD ---

export interface CreateProjectRoleRequest {
  name: string;
  description?: string | null;
  permissions?: Record<string, boolean>;
}

export interface UpdateProjectRoleRequest {
  name?: string;
  description?: string | null;
  permissions?: Record<string, boolean>;
}

export const createProjectRole = async (
  projectId: number,
  data: CreateProjectRoleRequest
): Promise<ProjectRoleWithPermissions> => {
  const response = await api.post(`/projects/${projectId}/roles`, data);
  return response.data;
};

export const updateProjectRole = async (
  projectId: number,
  roleId: number,
  data: UpdateProjectRoleRequest
): Promise<ProjectRoleWithPermissions> => {
  const response = await api.put(`/projects/${projectId}/roles/${roleId}`, data);
  return response.data;
};

export const deleteProjectRole = async (
  projectId: number,
  roleId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/projects/${projectId}/roles/${roleId}`);
  return response.data;
};


// --- BATCH 7 PROJECT SELECTOR REAL DASHBOARD ---

export interface DashboardTask {
  id: number;
  key: string;
  title: string;
  status: string;
  priority: string;
  story_points?: number | null;
  due_date?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  project_id: number;
  sprint_id?: number | null;
  created_at?: string | null;
}

export interface DashboardActiveSprint {
  id: number;
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  tasks_total: number;
  tasks_done: number;
  story_points_total: number;
  story_points_done: number;
  progress_percent: number;
}

export interface DashboardSummary {
  project: Project;
  members_count: number;
  pending_invites_count: number;
  tasks_total: number;
  tasks_by_status: Record<string, number>;
  tasks_by_priority: Record<string, number>;
  backlog_count: number;
  my_active_tasks_count: number;
  my_tasks: DashboardTask[];
  done_tasks_count: number;
  total_story_points: number;
  done_story_points: number;
  active_sprint?: DashboardActiveSprint | null;
}

export interface DashboardActivityItem {
  id: number;
  task_id: number;
  task_key: string;
  task_title: string;
  actor_id?: number | null;
  actor_name: string;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export const getProjectDashboardSummary = async (
  projectId: number
): Promise<DashboardSummary> => {
  const response = await api.get(`/projects/${projectId}/dashboard/summary`);
  return response.data;
};

export const getProjectDashboardActivity = async (
  projectId: number,
  limit = 12
): Promise<DashboardActivityItem[]> => {
  const response = await api.get(`/projects/${projectId}/dashboard/activity`, {
    params: { limit },
  });
  return response.data;
};



// --- BATCH 7 REAL DASHBOARD ---

export interface DashboardTaskSummary {
  id: number;
  key: string;
  title: string;
  status: string;
  priority: string;
  story_points?: number | null;
  due_date?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  sprint_id?: number | null;
  created_at?: string | null;
}

export interface DashboardActiveSprint {
  id: number;
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_active: boolean;
  total_tasks: number;
  done_tasks: number;
  progress_percent: number;
}

export interface DashboardRecentActivity {
  id: number;
  task_id: number;
  task_key?: string | null;
  task_title?: string | null;
  actor_name?: string | null;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  created_at: string;
}

export interface DashboardRiskCard {
  title: string;
  value: string;
  severity: "low" | "medium" | "high";
  detail: string;
}

export interface ProjectDashboardData {
  project: Project;
  metrics: {
    total_tasks: number;
    active_tasks: number;
    completed_tasks: number;
    backlog_tasks: number;
    unassigned_tasks: number;
    due_soon_tasks: number;
    overdue_tasks: number;
    critical_open_tasks: number;
    review_tasks: number;
    completion_rate: number;
    team_members_count: number;
    team_health_score: number;
    total_story_points: number;
    completed_story_points: number;
  };
  active_sprint: DashboardActiveSprint | null;
  my_active_tasks: DashboardTaskSummary[];
  status_distribution: Record<string, number>;
  priority_distribution: Record<string, number>;
  recent_activity: DashboardRecentActivity[];
  risk_cards: DashboardRiskCard[];
}

export const getProjectDashboard = async (
  projectId: number
): Promise<ProjectDashboardData> => {
  const response = await api.get(`/projects/${projectId}/dashboard`);
  return response.data;
};

// --- PRIORITY 3 WORKLOAD BALANCER V1 ---

export interface WorkloadTask {
  id: number;
  key: string;
  title: string;
  status: string;
  priority: string;
  story_points?: number | null;
  due_date?: string | null;
  assignee_id?: number | null;
  assignee_name?: string | null;
  assignee_avatar_url?: string | null;
  sprint_id?: number | null;
}

export interface WorkloadMember {
  membership_id: number;
  user_id: number;
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  role_name: string;
  active_tasks: number;
  story_points: number;
  overdue_tasks: number;
  review_tasks: number;
  critical_tasks: number;
  risk_score: number;
  load_label: "Available" | "Balanced" | "Busy" | "Overloaded" | string;
  tasks: WorkloadTask[];
}

export interface ProjectWorkload {
  project: Project;
  summary: {
    members_count: number;
    active_tasks: number;
    assigned_tasks: number;
    unassigned_tasks: number;
    unassigned_story_points: number;
    total_story_points: number;
    overdue_tasks: number;
    review_tasks: number;
    overloaded_members: number;
  };
  members: WorkloadMember[];
  unassigned_tasks: WorkloadTask[];
}

export interface WorkloadSuggestion {
  type: "REASSIGN_TASK" | "ASSIGN_UNASSIGNED_TASK" | "NO_ACTION_NEEDED" | string;
  severity: "low" | "medium" | "high" | string;
  task_id?: number | null;
  task_key?: string | null;
  task_title?: string | null;
  from_user_id?: number | null;
  from_name?: string | null;
  to_user_id?: number | null;
  to_name?: string | null;
  reason: string;
}

export interface WorkloadSuggestionsResponse {
  summary: string;
  suggestions: WorkloadSuggestion[];
}

export const getProjectWorkload = async (
  projectId: number
): Promise<ProjectWorkload> => {
  const response = await api.get(`/projects/${projectId}/workload`);
  return response.data;
};

export const getProjectWorkloadSuggestions = async (
  projectId: number
): Promise<WorkloadSuggestionsResponse> => {
  const response = await api.post(`/projects/${projectId}/workload/ai-suggestions`);
  return response.data;
};

// --- PRIORITY 4 REPORTING V1 ---

export interface ReportDistributionPoint {
  name: string;
  value: number;
}

export interface ReportVelocityPoint {
  sprint_id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  total_points: number;
  done_points: number;
  done_tasks: number;
  total_tasks: number;
}

export interface ReportActiveSprint {
  sprint_id: number;
  name: string;
  goal?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_points: number;
  done_points: number;
  remaining_points: number;
  total_tasks: number;
  done_tasks: number;
}

export interface ReportStatusAgePoint {
  status: string;
  tasks: number;
  average_age_days: number;
  max_age_days: number;
}

export interface ReportLeadTimePoint {
  name: string;
  value: number;
  tasks: number;
}

export interface ReportCumulativeFlowPoint {
  date: string;
  TODO: number;
  IN_PROGRESS: number;
  REVIEW: number;
  DONE: number;
}

export interface ReportSprintBurndownPoint {
  date: string;
  remaining_points: number;
  done_points: number;
  ideal_remaining: number;
}

export interface ProjectReportsOverview {
  project: Project;
  summary: {
    total_tasks: number;
    active_tasks: number;
    done_tasks: number;
    completion_rate: number;
    total_story_points: number;
    completed_story_points: number;
    story_point_completion_rate: number;
    overdue_tasks: number;
    due_soon_tasks: number;
    average_cycle_time_days: number;
    closed_sprints: number;
  };
  velocity: ReportVelocityPoint[];
  active_sprint?: ReportActiveSprint | null;
  status_distribution: ReportDistributionPoint[];
  priority_distribution: ReportDistributionPoint[];
  status_age: ReportStatusAgePoint[];
  status_change_counts: ReportDistributionPoint[];
  lead_time_distribution: ReportLeadTimePoint[];
  cumulative_flow: ReportCumulativeFlowPoint[];
  sprint_burndown: ReportSprintBurndownPoint[];
  bottleneck?: ReportStatusAgePoint | null;
}

export const getProjectReportsOverview = async (
  projectId: number
): Promise<ProjectReportsOverview> => {
  const response = await api.get(`/projects/${projectId}/reports/overview`);
  return response.data;
};

export const downloadProjectStatusReportPdf = async (
  projectId: number
): Promise<Blob> => {
  const response = await api.get(`/projects/${projectId}/reports/status.pdf`, {
    responseType: "blob",
  });

  return response.data;
};
