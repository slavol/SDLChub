import { ProjectWorkflowColumn } from "@/services/project";

export const PERMISSION_GROUPS = [
  {
    title: "Project",
    keys: ["PROJECT_UPDATE", "PROJECT_DELETE", "SETTINGS_MANAGE"],
  },
  {
    title: "Team",
    keys: ["MEMBER_INVITE", "MEMBER_REMOVE", "ROLE_MANAGE", "TEAM_MANAGE"],
  },
  {
    title: "Tasks",
    keys: ["TASK_CREATE", "TASK_UPDATE", "TASK_DELETE", "TASK_ASSIGN", "TASK_MOVE", "TASK_COMMENT"],
  },
  {
    title: "Sprints",
    keys: ["SPRINT_CREATE", "SPRINT_UPDATE", "SPRINT_START", "SPRINT_CLOSE", "SPRINT_DELETE"],
  },
  {
    title: "Calendar",
    keys: ["CALENDAR_CREATE", "CALENDAR_UPDATE", "CALENDAR_DELETE"],
  },
  {
    title: "AI & Reports",
    keys: ["AI_USE", "REPORT_VIEW"],
  },
];

export const PERMISSION_LABELS: Record<string, string> = {
  PROJECT_UPDATE: "Update project",
  PROJECT_DELETE: "Delete project",
  SETTINGS_MANAGE: "Manage settings",
  MEMBER_INVITE: "Invite members",
  MEMBER_REMOVE: "Remove members",
  ROLE_MANAGE: "Manage roles",
  TEAM_MANAGE: "Manage teams",
  TASK_CREATE: "Create tasks",
  TASK_UPDATE: "Update tasks",
  TASK_DELETE: "Delete tasks",
  TASK_ASSIGN: "Assign tasks",
  TASK_MOVE: "Move tasks",
  TASK_COMMENT: "Comment on tasks",
  SPRINT_CREATE: "Create sprints",
  SPRINT_UPDATE: "Edit sprints",
  SPRINT_START: "Start sprints",
  SPRINT_CLOSE: "Close sprints",
  SPRINT_DELETE: "Delete sprints",
  CALENDAR_CREATE: "Create calendar events",
  CALENDAR_UPDATE: "Edit calendar events",
  CALENDAR_DELETE: "Delete calendar events",
  AI_USE: "Use AI",
  REPORT_VIEW: "View reports",
};

export const METHODOLOGY_HELP: Record<string, string> = {
  SCRUM: "Best for sprint planning, backlog grooming and regular delivery cycles.",
  KANBAN: "Best for continuous work, support, maintenance and flow-based delivery.",
  SCRUMBAN: "Best when you want Scrum planning with Kanban-style flexibility.",
};

export const WIP_LIMIT_COLUMNS = [
  { key: "TODO", label: "To Do", helper: "Intake lane", color: "bg-slate-500" },
  { key: "IN_PROGRESS", label: "In Progress", helper: "Active implementation", color: "bg-blue-500" },
  { key: "REVIEW", label: "Review", helper: "Code review / QA", color: "bg-purple-500" },
  { key: "DONE", label: "Done", helper: "Usually unlimited", color: "bg-green-500" },
];

export const DEFAULT_BOARD_COLUMNS: ProjectWorkflowColumn[] = WIP_LIMIT_COLUMNS.map((column, index) => ({
  key: column.key,
  label: column.label,
  enabled: true,
  order: index,
  color: column.color,
}));

export const DEFAULT_WIP_LIMITS: Record<string, number | null> = {
  TODO: null,
  IN_PROGRESS: 3,
  REVIEW: 2,
  DONE: null,
};
