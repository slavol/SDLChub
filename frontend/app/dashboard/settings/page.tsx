"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  GitBranch,
  History,
  KeyRound,
  Loader2,
  Lock,
  Save,
  Settings,
  Shield,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasProjectPermission } from "@/lib/project-permissions";
import {
  applyMethodologyTransition,
  deleteProject,
  getProjectAuditLogs,
  getMethodologyTransitionPreview,
  getMyProjects,
  getProjectDetail,
  getProjectMembers,
  getProjectRoles,
  MethodologyTransitionPreview,
  Project,
  ProjectAuditLog,
  ProjectMember,
  ProjectWorkflowColumn,
  ProjectRoleWithPermissions,
  ProjectAiConfig,
  getProjectAiSettings,
  testProjectAiSettings,
  updateProjectAiSettings,
  updateProjectWorkflow,
  updateProjectSettings,
  updateRolePermissions,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const PERMISSION_GROUPS = [
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
    keys: ["SPRINT_CREATE", "SPRINT_START", "SPRINT_CLOSE"],
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

const PERMISSION_LABELS: Record<string, string> = {
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
  SPRINT_START: "Start sprints",
  SPRINT_CLOSE: "Close sprints",
  CALENDAR_CREATE: "Create calendar events",
  CALENDAR_UPDATE: "Edit calendar events",
  CALENDAR_DELETE: "Delete calendar events",
  AI_USE: "Use AI",
  REPORT_VIEW: "View reports",
};

const METHODOLOGY_HELP: Record<string, string> = {
  SCRUM: "Best for sprint planning, backlog grooming and regular delivery cycles.",
  KANBAN: "Best for continuous work, support, maintenance and flow-based delivery.",
  SCRUMBAN: "Best when you want Scrum planning with Kanban-style flexibility.",
};

const WIP_LIMIT_COLUMNS = [
  { key: "TODO", label: "To Do", helper: "Intake lane", color: "bg-slate-500" },
  { key: "IN_PROGRESS", label: "In Progress", helper: "Active implementation", color: "bg-blue-500" },
  { key: "REVIEW", label: "Review", helper: "Code review / QA", color: "bg-purple-500" },
  { key: "DONE", label: "Done", helper: "Usually unlimited", color: "bg-green-500" },
];

const DEFAULT_BOARD_COLUMNS: ProjectWorkflowColumn[] = WIP_LIMIT_COLUMNS.map((column, index) => ({
  key: column.key,
  label: column.label,
  enabled: true,
  order: index,
  color: column.color,
}));

const DEFAULT_WIP_LIMITS: Record<string, number | null> = {
  TODO: null,
  IN_PROGRESS: 3,
  REVIEW: 2,
  DONE: null,
};

function enabledPermissions(role: ProjectRoleWithPermissions) {
  return Object.values(role.permissions || {}).filter(Boolean).length;
}

function roleTone(roleName: string) {
  if (roleName === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (roleName.includes("Manager") || roleName.includes("Owner")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (roleName.includes("Lead") || roleName.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function projectAuditLabel(action: string) {
  return (
    {
      PROJECT_METHODOLOGY_CHANGED: "Methodology changed",
      PROJECT_SETTINGS_UPDATED: "Settings updated",
      PROJECT_WORKFLOW_UPDATED: "Workflow updated",
      AI_SETTINGS_UPDATED: "AI settings updated",
    }[action] || action.replaceAll("_", " ").toLowerCase()
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject, clearCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [roles, setRoles] = useState<ProjectRoleWithPermissions[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [myRoleName, setMyRoleName] = useState("Member");
  const [myMembership, setMyMembership] = useState<ProjectMember | null>(null);
  const [auditLogs, setAuditLogs] = useState<ProjectAuditLog[]>([]);

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [methodology, setMethodology] = useState("SCRUM");
  const [wipLimits, setWipLimits] = useState<Record<string, number | null>>(DEFAULT_WIP_LIMITS);
  const [boardColumns, setBoardColumns] = useState<ProjectWorkflowColumn[]>(DEFAULT_BOARD_COLUMNS);
  const [deleteKey, setDeleteKey] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingPermission, setSavingPermission] = useState<string | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [transitionOpen, setTransitionOpen] = useState(false);
  const [transitionPreview, setTransitionPreview] = useState<MethodologyTransitionPreview | null>(null);
  const [loadingTransition, setLoadingTransition] = useState(false);
  const [applyingTransition, setApplyingTransition] = useState(false);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [aiConfig, setAiConfig] = useState<ProjectAiConfig | null>(null);
  const [aiMode, setAiMode] = useState<"PLATFORM" | "PROJECT">("PLATFORM");
  const [aiProvider, setAiProvider] = useState("GEMINI");
  const [aiProviderName, setAiProviderName] = useState("Gemini");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [testingAiSettings, setTestingAiSettings] = useState(false);

  const isProjectOwner = project?.owner_id === currentUser?.id;
  const canManageSettings = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "SETTINGS_MANAGE"
  );
  const canManageRoles = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "ROLE_MANAGE"
  );

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const loadData = async () => {
    setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = projects[0] ?? null;

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      if (!selectedProject) {
        setProject(null);
        return;
      }

      const [freshProject, remoteRoles, members] = await Promise.all([
        getProjectDetail(selectedProject.id),
        getProjectRoles(selectedProject.id),
        getProjectMembers(selectedProject.id),
      ]);

      const membership = members.find((member) => member.user.id === currentUser?.id);
      const canLoadAudit =
        freshProject.owner_id === currentUser?.id ||
        currentUser?.is_global_admin ||
        hasProjectPermission(freshProject, currentUser, membership || null, "SETTINGS_MANAGE");
      const remoteAuditLogs = canLoadAudit
        ? await getProjectAuditLogs(freshProject.id).catch(() => [])
        : [];

      setProject(freshProject);
      setCurrentProject(freshProject);
      setRoles(remoteRoles);
      setMemberCount(members.length);
      setMyRoleName(membership?.role?.name || "Member");
      setMyMembership(membership || null);
      setAuditLogs(remoteAuditLogs);

      setProjectName(freshProject.name);
      setDescription(freshProject.description || "");
      setMethodology(freshProject.methodology);
      setWipLimits({
        ...DEFAULT_WIP_LIMITS,
        ...(freshProject.workflow_config?.wip_limits || {}),
      });
      setBoardColumns(
        (freshProject.workflow_config?.columns?.length
          ? freshProject.workflow_config.columns
          : DEFAULT_BOARD_COLUMNS
        ).map((column, index) => ({
          ...DEFAULT_BOARD_COLUMNS[index],
          ...column,
          order: typeof column.order === "number" ? column.order : index,
        }))
      );
      setAiConfig(freshProject.ai_config || null);
      setAiMode((freshProject.ai_config?.mode as "PLATFORM" | "PROJECT") || "PLATFORM");
      setAiProvider(freshProject.ai_config?.provider || "GEMINI");
      setAiProviderName(freshProject.ai_config?.provider_name || "Gemini");
      setAiBaseUrl(freshProject.ai_config?.base_url || "");
      setAiModel(freshProject.ai_config?.model || "");
      setAiApiKey("");

      if (freshProject.owner_id === currentUser?.id || currentUser?.is_global_admin) {
        const remoteAiSettings = await getProjectAiSettings(freshProject.id);
        setAiConfig(remoteAiSettings);
        setAiMode(remoteAiSettings.mode);
        setAiProvider(remoteAiSettings.provider || "GEMINI");
        setAiProviderName(remoteAiSettings.provider_name || "Gemini");
        setAiBaseUrl(remoteAiSettings.base_url || "");
        setAiModel(remoteAiSettings.model || "");
      }

      if (!selectedRoleId && remoteRoles.length > 0) {
        setSelectedRoleId(String(remoteRoles[0].id));
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, currentUser?.id]);

  const handleSaveProject = async () => {
    if (!canManageSettings) return;
    if (!project) return;

    setSavingProject(true);
    try {
      const updated = await updateProjectSettings(project.id, {
        name: projectName,
        description,
      });

      setProject(updated);
      setCurrentProject(updated);
      setAuditLogs(await getProjectAuditLogs(updated.id).catch(() => auditLogs));

      if (methodology !== updated.methodology) {
        setLoadingTransition(true);
        try {
          const preview = await getMethodologyTransitionPreview(project.id, methodology);
          setTransitionPreview(preview);
          setTransitionOpen(true);
          toast.info("Review methodology impact before applying.");
        } finally {
          setLoadingTransition(false);
        }
      } else {
        toast.success("Project settings saved");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save project settings."));
    } finally {
      setSavingProject(false);
    }
  };

  const handleApplyMethodologyTransition = async () => {
    if (!canManageSettings) return;
    if (!project || !transitionPreview) return;

    setApplyingTransition(true);
    try {
      const result = await applyMethodologyTransition(
        project.id,
        transitionPreview.target_methodology,
        transitionPreview.recommended_strategy
      );

      setProject(result.project);
      setCurrentProject(result.project);
      setMethodology(result.project.methodology);
      setTransitionOpen(false);
      setTransitionPreview(null);
      toast.success(result.message || "Methodology updated");

      if (result.project.methodology === "KANBAN") {
        router.push("/dashboard/board");
      } else {
        router.push("/dashboard/backlog");
      }

      router.refresh();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not change methodology."));
    } finally {
      setApplyingTransition(false);
    }
  };

  const handleWipLimitChange = (key: string, value: string) => {
    setWipLimits((current) => ({
      ...current,
      [key]: value === "" ? null : Math.max(0, Number(value)),
    }));
  };

  const handleColumnLabelChange = (key: string, value: string) => {
    setBoardColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, label: value } : column
      )
    );
  };

  const handleColumnEnabledChange = (key: string, enabled: boolean) => {
    setBoardColumns((current) =>
      current.map((column) =>
        column.key === key ? { ...column, enabled } : column
      )
    );
  };

  const moveBoardColumn = (key: string, direction: -1 | 1) => {
    setBoardColumns((current) => {
      const ordered = [...current].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((column) => column.key === key);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return current;

      const next = [...ordered];
      const [column] = next.splice(index, 1);
      next.splice(targetIndex, 0, column);
      return next.map((item, order) => ({ ...item, order }));
    });
  };

  const handleSaveWorkflow = async () => {
    if (!canManageSettings || !project) return;

    setSavingWorkflow(true);
    try {
      const updated = await updateProjectWorkflow(project.id, {
        wip_limits: wipLimits,
        columns: boardColumns.map((column, index) => ({
          ...column,
          label: column.label.trim() || DEFAULT_BOARD_COLUMNS.find((item) => item.key === column.key)?.label || column.key,
          order: index,
          enabled: column.key === "DONE" ? true : column.enabled,
        })),
      });
      setProject(updated);
      setCurrentProject(updated);
      setWipLimits({
        ...DEFAULT_WIP_LIMITS,
        ...(updated.workflow_config?.wip_limits || {}),
      });
      setBoardColumns(updated.workflow_config?.columns || DEFAULT_BOARD_COLUMNS);
      setAuditLogs(await getProjectAuditLogs(updated.id).catch(() => auditLogs));
      toast.success("Board workflow saved");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save workflow limits."));
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleSaveAiSettings = async () => {
    if (!project || !isProjectOwner) return;

    setSavingAiSettings(true);
    try {
      const updated = await updateProjectAiSettings(project.id, {
        mode: aiMode,
        provider: aiProvider,
        provider_name: aiProviderName.trim() || aiProvider,
        base_url: aiProvider === "OPENAI_COMPATIBLE" ? aiBaseUrl.trim() : undefined,
        model: aiModel.trim() || undefined,
        api_key: aiApiKey.trim() || undefined,
      });

      setAiConfig(updated);
      setAiProvider(updated.provider || "GEMINI");
      setAiProviderName(updated.provider_name || "Gemini");
      setAiBaseUrl(updated.base_url || "");
      setAiModel(updated.model || "");
      setProject((current) =>
        current ? { ...current, ai_config: updated } : current
      );
      setCurrentProject({ ...project, ai_config: updated });
      setAuditLogs(await getProjectAuditLogs(project.id).catch(() => auditLogs));
      setAiApiKey("");
      toast.success("AI settings saved securely.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save AI settings."));
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleClearProjectAiKey = async () => {
    if (!project || !isProjectOwner) return;

    setSavingAiSettings(true);
    try {
      const updated = await updateProjectAiSettings(project.id, {
        mode: "PLATFORM",
        provider: aiProvider,
        provider_name: aiProviderName.trim() || aiProvider,
        base_url: aiProvider === "OPENAI_COMPATIBLE" ? aiBaseUrl.trim() : undefined,
        model: aiModel.trim() || undefined,
        clear_api_key: true,
      });
      setAiMode(updated.mode);
      setAiConfig(updated);
      setAiProvider(updated.provider || "GEMINI");
      setAiProviderName(updated.provider_name || "Gemini");
      setAiBaseUrl(updated.base_url || "");
      setAiModel(updated.model || "");
      setAiApiKey("");
      setProject((current) =>
        current ? { ...current, ai_config: updated } : current
      );
      setCurrentProject({ ...project, ai_config: updated });
      setAuditLogs(await getProjectAuditLogs(project.id).catch(() => auditLogs));
      toast.success("Project AI key removed.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not remove project AI key."));
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleTestAiSettings = async () => {
    if (!project || !isProjectOwner) return;

    setTestingAiSettings(true);
    try {
      const result = await testProjectAiSettings(project.id);
      if (result.ok) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not test AI settings."));
    } finally {
      setTestingAiSettings(false);
    }
  };

  const handleTogglePermission = async (key: string) => {
    if (!canManageRoles) return;
    if (!project || !selectedRole || selectedRole.name === "Project Admin") return;

    const nextPermissions = {
      ...selectedRole.permissions,
      [key]: !selectedRole.permissions?.[key],
    };

    setSavingPermission(key);

    setRoles((current) =>
      current.map((role) =>
        role.id === selectedRole.id ? { ...role, permissions: nextPermissions } : role
      )
    );

    try {
      const updated = await updateRolePermissions(project.id, selectedRole.id, nextPermissions);
      setRoles((current) =>
        current.map((role) => (role.id === selectedRole.id ? updated : role))
      );
      toast.success("Permission updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update permission."));
      await loadData();
    } finally {
      setSavingPermission(null);
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    setDeletingProject(true);
    try {
      await deleteProject(project.id, deleteKey);
      clearCurrentProject();
      toast.success("Project deleted");
      router.push("/onboarding");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete project."));
    } finally {
      setDeletingProject(false);
      setDeleteProjectOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-blue-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  if (!canManageSettings) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-slate-50">
        <Card className="border-slate-800 bg-slate-900 text-slate-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-300" />
              Settings unavailable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-400">
              Only the project owner or Project Admin can manage project settings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deleteReady = deleteKey.trim().toUpperCase() === project.key;
  const selectedRoleLocked = selectedRole?.name === "Project Admin";

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                  {project.key}
                </Badge>
                <Badge className="bg-purple-500/10 text-purple-300 hover:bg-purple-500/10">
                  {project.methodology}
                </Badge>
                {isProjectOwner && (
                  <Badge className="bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
                    <Crown className="mr-1 h-3 w-3" />
                    Owner
                  </Badge>
                )}
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                Project settings
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage project identity, methodology, permissions and destructive actions.
              </p>
            </div>

            <Button
              onClick={handleSaveProject}
              disabled={savingProject || loadingTransition}
              className="h-11 bg-blue-600 px-5 hover:bg-blue-700"
            >
              {savingProject || loadingTransition ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {methodology !== project.methodology ? "Review change" : "Save changes"}
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Methodology</p>
                <p className="text-xl font-bold">{methodology}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Roles</p>
                <p className="text-xl font-bold">{roles.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Members</p>
                <p className="text-xl font-bold">{memberCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Your access</p>
                <p className="text-lg font-bold">{isProjectOwner ? "Owner" : myRoleName}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-5 w-5 text-blue-300" />
                  General
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="space-y-2">
                    <Label>Project name</Label>
                    <Input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      className="h-11 border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Project key</Label>
                    <Input
                      value={project.key}
                      disabled
                      className="h-11 border-slate-800 bg-slate-950 font-mono text-slate-500"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    className="min-h-28 border-slate-700 bg-slate-950"
                    placeholder="Describe what this project is about."
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="space-y-2">
                    <Label>Methodology</Label>
                    <Select value={methodology} onValueChange={setMethodology}>
                      <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                        <SelectItem value="SCRUM">SCRUM</SelectItem>
                        <SelectItem value="KANBAN">KANBAN</SelectItem>
                        <SelectItem value="SCRUMBAN">SCRUMBAN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                      <p className="font-medium text-white">{methodology}</p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {METHODOLOGY_HELP[methodology]}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-5 w-5 text-violet-300" />
                  Project AI provider
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="font-semibold text-violet-100">
                        Choose how this project uses AI
                      </p>
                      <p className="mt-2 text-sm leading-6 text-violet-100/75">
                        Use the platform AI key or provide a project-owned provider.
                        Custom keys are encrypted server-side and are never sent back to the browser.
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className="w-fit border-violet-400/30 bg-violet-500/10 text-violet-100"
                    >
                      {aiConfig?.mode || "PLATFORM"} · {aiConfig?.provider_name || aiConfig?.provider || "Gemini"}
                    </Badge>
                  </div>
                </div>

                {!isProjectOwner ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <p className="text-sm font-semibold text-slate-200">
                      Owner-only setting
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Only the project owner can add or rotate AI credentials.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                      <div className="space-y-2">
                        <Label>AI mode</Label>
                        <Select
                          value={aiMode}
                          onValueChange={(value) =>
                            setAiMode(value as "PLATFORM" | "PROJECT")
                          }
                        >
                          <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                            <SelectItem value="PLATFORM">Platform AI key</SelectItem>
                            <SelectItem value="PROJECT">Project-owned key</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                            Platform key
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {aiConfig?.platform_configured ? "Configured" : "Not configured"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                            Project key
                          </p>
                          <p className="mt-2 text-sm font-semibold text-white">
                            {aiConfig?.has_project_key ? "Stored encrypted" : "Not added"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {aiMode === "PROJECT" && (
                      <div className="space-y-4">
                        <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
                          <div className="space-y-2">
                            <Label>Provider type</Label>
                            <Select
                              value={aiProvider}
                              onValueChange={(value) => {
                                setAiProvider(value);
                                if (value === "GEMINI") {
                                  setAiProviderName("Gemini");
                                  setAiBaseUrl("");
                                  setAiModel((current) => current || "gemini-2.5-flash");
                                } else {
                                  setAiProviderName("Custom AI");
                                  setAiModel((current) => current || "gpt-4o-mini");
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                                <SelectItem value="GEMINI">Gemini API</SelectItem>
                                <SelectItem value="OPENAI_COMPATIBLE">
                                  OpenAI-compatible / custom
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Provider display name</Label>
                            <Input
                              value={aiProviderName}
                              onChange={(event) => setAiProviderName(event.target.value)}
                              placeholder="e.g. OpenRouter Production, Groq, Company AI"
                              className="h-11 border-slate-700 bg-slate-950"
                            />
                          </div>
                        </div>

                        {aiProvider === "OPENAI_COMPATIBLE" && (
                          <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                            <div className="space-y-2">
                              <Label>Base URL</Label>
                              <Input
                                value={aiBaseUrl}
                                onChange={(event) => setAiBaseUrl(event.target.value)}
                                placeholder="https://api.openai.com/v1 or https://openrouter.ai/api/v1"
                                className="h-11 border-slate-700 bg-slate-950 font-mono text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Model</Label>
                              <Input
                                value={aiModel}
                                onChange={(event) => setAiModel(event.target.value)}
                                placeholder="gpt-4o-mini"
                                className="h-11 border-slate-700 bg-slate-950 font-mono text-sm"
                              />
                            </div>
                          </div>
                        )}

                        {aiProvider === "GEMINI" && (
                          <div className="space-y-2">
                            <Label>Model</Label>
                            <Input
                              value={aiModel}
                              onChange={(event) => setAiModel(event.target.value)}
                              placeholder="gemini-2.5-flash"
                              className="h-11 border-slate-700 bg-slate-950 font-mono text-sm"
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label>API key</Label>
                          <Input
                            type="password"
                            value={aiApiKey}
                            onChange={(event) => setAiApiKey(event.target.value)}
                            placeholder={
                              aiConfig?.has_project_key
                                ? "Leave empty to keep existing encrypted key"
                                : "Paste provider API key"
                            }
                            className="h-11 border-slate-700 bg-slate-950 font-mono"
                          />
                          <p className="text-xs leading-5 text-slate-500">
                            The key is encrypted before storage. For custom providers, use an OpenAI-compatible chat completions endpoint.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="button"
                        onClick={handleSaveAiSettings}
                        disabled={savingAiSettings}
                        className="h-11 bg-violet-600 text-white hover:bg-violet-500"
                      >
                        {savingAiSettings ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save AI settings
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestAiSettings}
                        disabled={testingAiSettings}
                        className="h-11 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                      >
                        {testingAiSettings ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Test provider
                      </Button>

                      {aiConfig?.has_project_key && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleClearProjectAiKey}
                          disabled={savingAiSettings}
                          className="h-11 border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Remove project key
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Workflow className="h-5 w-5 text-cyan-300" />
                    WIP limits
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5 p-5">
                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                    <p className="font-semibold text-cyan-100">
                      Board workflow for {methodology}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-cyan-100/75">
                      Configure lane labels, visibility, order and WIP pressure
                      for this project. Done remains visible to keep completed work auditable.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm text-slate-300">Board columns</Label>
                      <p className="mt-1 text-xs text-slate-500">
                        These settings change how the board is presented for this project.
                      </p>
                    </div>

                    {boardColumns
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((column, index, orderedColumns) => (
                        <div
                          key={column.key}
                          className="grid gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:grid-cols-[120px_minmax(0,1fr)_180px]"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${column.color || "bg-slate-500"}`} />
                            <Badge variant="outline" className="border-slate-700 bg-slate-900 font-mono text-[10px] text-slate-300">
                              {column.key}
                            </Badge>
                          </div>

                          <Input
                            value={column.label}
                            onChange={(event) => handleColumnLabelChange(column.key, event.target.value)}
                            className="h-10 border-slate-700 bg-slate-900"
                          />

                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveBoardColumn(column.key, -1)}
                              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={index === orderedColumns.length - 1}
                              onClick={() => moveBoardColumn(column.key, 1)}
                              className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                            >
                              Down
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={column.key === "DONE"}
                              onClick={() => handleColumnEnabledChange(column.key, !column.enabled)}
                              className={
                                column.enabled
                                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                                  : "border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800"
                              }
                            >
                              {column.enabled ? (
                                <Eye className="mr-2 h-4 w-4" />
                              ) : (
                                <EyeOff className="mr-2 h-4 w-4" />
                              )}
                              {column.enabled ? "Shown" : "Hidden"}
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {WIP_LIMIT_COLUMNS.map((column) => (
                      <div
                        key={column.key}
                        className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                      >
                        <Label className="text-sm text-slate-300">
                          {column.label}
                        </Label>
                        <p className="mt-1 text-xs text-slate-500">
                          {column.helper}
                        </p>
                        <Input
                          type="number"
                          min="0"
                          value={wipLimits[column.key] ?? ""}
                          onChange={(event) =>
                            handleWipLimitChange(column.key, event.target.value)
                          }
                          placeholder="No limit"
                          className="mt-3 h-11 border-slate-700 bg-slate-900"
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    onClick={handleSaveWorkflow}
                    disabled={!canManageSettings || savingWorkflow}
                    className="h-11 bg-cyan-600 text-white hover:bg-cyan-500"
                  >
                    {savingWorkflow ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save board workflow
                  </Button>
                </CardContent>
              </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-purple-300" />
                  Role permissions
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-5 p-5">
                <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="space-y-2">
                    <Label>Selected role</Label>
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRole && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={roleTone(selectedRole.name)}>
                          {selectedRole.name}
                        </Badge>
                        {selectedRoleLocked && (
                          <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                            Locked
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {selectedRole.description || "No description"}
                      </p>
                      <p className="mt-3 text-sm text-slate-400">
                        {selectedRoleLocked
                          ? "Project Admin always keeps full permissions."
                          : `${enabledPermissions(selectedRole)} permissions enabled.`}
                      </p>
                    </div>
                  )}
                </div>

                {selectedRole && (
                  <div className="space-y-4">
                    {PERMISSION_GROUPS.map((group) => (
                      <div key={group.title} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold text-white">{group.title}</h3>
                          {methodology === "KANBAN" && group.title === "Sprints" && (
                            <Badge className="border-slate-700 bg-slate-900 text-slate-400">
                              Disabled by Kanban
                            </Badge>
                          )}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          {group.keys.map((key) => {
                            const enabled = selectedRoleLocked || Boolean(selectedRole.permissions?.[key]);
                            const saving = savingPermission === key;
                            const disabledByMethodology =
                              methodology === "KANBAN" && group.title === "Sprints";

                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={!canManageRoles || selectedRoleLocked || savingPermission !== null || disabledByMethodology}
                                onClick={() => handleTogglePermission(key)}
                                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                                  enabled && !disabledByMethodology
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-100"
                                    : "border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700"
                                } disabled:cursor-not-allowed disabled:opacity-75`}
                              >
                                <span>
                                  <span className="block text-sm font-medium">
                                    {PERMISSION_LABELS[key] || key}
                                  </span>
                                  <span className="mt-1 block font-mono text-[11px] opacity-60">
                                    {key}
                                  </span>
                                </span>

                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <span className={`h-3 w-3 rounded-full ${enabled && !disabledByMethodology ? "bg-blue-300" : "bg-slate-700"}`} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <aside className="space-y-6">
            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lock className="h-5 w-5 text-emerald-300" />
                  Governance
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 p-5">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="font-semibold text-emerald-200">Owner override</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    The project owner can manage project settings and team access.
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
                  <p className="font-semibold text-blue-200">Protected admin role</p>
                  <p className="mt-2 text-sm leading-6 text-blue-100/80">
                    Project Admin permissions are locked to prevent accidental lockout.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                  <p className="font-semibold text-white">Recommendation</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Keep Project Admin limited. Use custom roles for developers, QA, product and observers.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-5 w-5 text-violet-300" />
                  Project audit trail
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 p-5">
                {auditLogs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        name={log.actor_name || "System"}
                        src={log.actor_avatar_url}
                        className="h-8 w-8"
                        fallbackClassName="bg-violet-500/10 text-[10px] text-violet-200"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-100">
                            {projectAuditLabel(log.action)}
                          </p>
                          {log.field && (
                            <Badge
                              variant="outline"
                              className="border-slate-700 bg-slate-900 text-[10px] text-slate-400"
                            >
                              {log.field}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {log.actor_name || "System"} · {formatAuditDate(log.created_at)}
                        </p>
                        {log.field && (
                          <div className="mt-3 rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-slate-400">
                            <span className="break-words text-rose-300">
                              {log.old_value || "-"}
                            </span>
                            <span className="px-2 text-slate-600">-&gt;</span>
                            <span className="break-words text-emerald-300">
                              {log.new_value || "-"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {auditLogs.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-6 text-center">
                    <p className="text-sm font-semibold text-slate-300">
                      No project audit events yet
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Methodology, workflow, AI and project-setting changes will appear here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-red-950/60 bg-red-950/10 text-slate-50">
              <CardHeader className="border-b border-red-950/50">
                <CardTitle className="flex items-center gap-2 text-base text-red-300">
                  <AlertTriangle className="h-5 w-5" />
                  Danger zone
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-4 p-5">
                <p className="text-sm leading-6 text-slate-400">
                  Deleting this project removes members, roles, invitations, sprints, tasks, subtasks, comments and audit logs.
                </p>

                <div className="space-y-2">
                  <Label>
                    Type project key:{" "}
                    <span className="font-mono text-red-300">{project.key}</span>
                  </Label>
                  <Input
                    value={deleteKey}
                    onChange={(event) => setDeleteKey(event.target.value)}
                    placeholder={project.key}
                    className="h-11 border-red-950/70 bg-slate-950 font-mono"
                  />
                </div>

                <Button
                  variant="destructive"
                  disabled={!deleteReady}
                  onClick={() => setDeleteProjectOpen(true)}
                  className="w-full"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete project
                </Button>
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
      <Dialog
        open={transitionOpen}
        onOpenChange={(open) => {
          setTransitionOpen(open);
          if (!open) {
            setTransitionPreview(null);
            setMethodology(project.methodology);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-50 sm:max-w-3xl">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
              <GitBranch className="h-5 w-5" />
            </div>
            <DialogTitle>Change methodology?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Review the workflow impact before applying this project-wide change.
            </DialogDescription>
          </DialogHeader>

          {transitionPreview && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Current</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {transitionPreview.current_methodology}
                  </p>
                </div>
                <div className="hidden justify-center text-slate-500 md:flex">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-blue-300/70">Target</p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {transitionPreview.target_methodology}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Total tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.total_tasks}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Backlog tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.backlog_tasks}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Sprint tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.sprint_tasks}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Active sprint tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.active_sprint_tasks}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Future sprints</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.future_sprints}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-500">Estimated tasks</p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    {transitionPreview.affected_counts.story_point_tasks}
                  </p>
                </div>
              </div>

              {transitionPreview.blockers.length > 0 && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                  <p className="mb-3 flex items-center gap-2 font-semibold text-red-200">
                    <AlertTriangle className="h-4 w-4" />
                    Blockers
                  </p>
                  <div className="space-y-2">
                    {transitionPreview.blockers.map((blocker) => (
                      <p key={blocker} className="text-sm leading-6 text-red-100/85">
                        {blocker}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {transitionPreview.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                  <p className="mb-3 font-semibold text-amber-200">Warnings</p>
                  <div className="space-y-2">
                    {transitionPreview.warnings.map((warning) => (
                      <p key={warning} className="text-sm leading-6 text-amber-100/85">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <p className="mb-3 font-semibold text-emerald-200">Actions that will be applied</p>
                <div className="space-y-2">
                  {transitionPreview.actions.map((action) => (
                    <p key={action} className="flex gap-2 text-sm leading-6 text-emerald-100/85">
                      <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                      {action}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              className="text-slate-400 hover:text-white"
              disabled={applyingTransition}
              onClick={() => {
                setTransitionOpen(false);
                setTransitionPreview(null);
                setMethodology(project.methodology);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!transitionPreview?.can_apply || applyingTransition}
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleApplyMethodologyTransition}
            >
              {applyingTransition && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply Methodology Change
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteProjectOpen}
        onOpenChange={setDeleteProjectOpen}
        title={`Delete "${project.name}"?`}
        description="This permanently removes members, roles, invitations, sprints, tasks, subtasks, comments and audit logs for this project."
        confirmLabel="Delete Project"
        destructive
        loading={deletingProject}
        onConfirm={handleDeleteProject}
      />
    </div>
  );
}
