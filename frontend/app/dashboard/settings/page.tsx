"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  Crown,
  Eye,
  EyeOff,
  ExternalLink,
  GitBranch,
  Github,
  History,
  Loader2,
  Lock,
  PlugZap,
  RefreshCw,
  Save,
  Server,
  Shield,
  Trash2,
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
import { AuditLogEvent } from "@/components/dashboard/audit-log-event";
import { getApiErrorMessage } from "@/lib/api-error";
import { hasProjectPermission } from "@/lib/project-permissions";
import { pickWorkspaceProject } from "@/lib/project-selection";
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
  ProjectWorkflowColumn,
  ProjectMember,
  ProjectRoleWithPermissions,
  ProjectAiConfig,
  deleteProjectLogo,
  getProjectAiSettings,
  testProjectAiSettings,
  uploadProjectLogo,
  updateProjectAiSettings,
  updateProjectWorkflow,
  updateProjectSettings,
  updateRolePermissions,
  transferProjectOwnership,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";
import {
  deleteProjectGitHubIntegration,
  getProjectGitHubIntegration,
  GitHubIntegration,
  getNgrokTunnelStatus,
  NgrokTunnelStatus,
  startNgrokTunnel,
  stopNgrokTunnel,
  testProjectGitHubIntegration,
  upsertProjectGitHubIntegration,
} from "@/services/github";
import {
  SettingsHero,
  SettingsLoadingState,
  SettingsSummaryCards,
  SettingsUnavailableState,
} from "./settings-components";
import { SettingsGeneralCard } from "./settings-general-card";
import {
  DEFAULT_BOARD_COLUMNS,
  DEFAULT_WIP_LIMITS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  WIP_LIMIT_COLUMNS,
} from "./settings-constants";
import {
  enabledPermissions,
  formatSettingsDate,
  githubRepoUrlFromFullName,
  githubStatusTone,
  normalizeGithubWebhookUrl,
  roleTone,
} from "./settings-utils";

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject, clearCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [roles, setRoles] = useState<ProjectRoleWithPermissions[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
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
  const [uploadingProjectLogo, setUploadingProjectLogo] = useState(false);
  const [removingProjectLogo, setRemovingProjectLogo] = useState(false);
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
  const [aiProvider, setAiProvider] = useState("OLLAMA");
  const [aiProviderName, setAiProviderName] = useState("Qwen local (Ollama)");
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [savingAiSettings, setSavingAiSettings] = useState(false);
  const [testingAiSettings, setTestingAiSettings] = useState(false);
  const [githubIntegration, setGithubIntegration] = useState<GitHubIntegration | null>(null);
  const [githubRepositoryFullName, setGithubRepositoryFullName] = useState("");
  const [githubRepositoryUrl, setGithubRepositoryUrl] = useState("");
  const [githubDefaultBranch, setGithubDefaultBranch] = useState("main");
  const [githubPublicBaseUrl, setGithubPublicBaseUrl] = useState("");
  const [githubAutoLinkCommits, setGithubAutoLinkCommits] = useState(true);
  const [githubAutoTransitionPrs, setGithubAutoTransitionPrs] = useState(true);
  const [savingGithubSettings, setSavingGithubSettings] = useState(false);
  const [testingGithubSettings, setTestingGithubSettings] = useState(false);
  const [disconnectingGithub, setDisconnectingGithub] = useState(false);
  const [ngrokStatus, setNgrokStatus] = useState<NgrokTunnelStatus | null>(null);
  const [startingNgrok, setStartingNgrok] = useState(false);
  const [stoppingNgrok, setStoppingNgrok] = useState(false);
  const [ownershipTargetUserId, setOwnershipTargetUserId] = useState("");
  const [ownershipConfirmKey, setOwnershipConfirmKey] = useState("");
  const [transferringOwnership, setTransferringOwnership] = useState(false);

  const isProjectOwner = project?.owner_id === currentUser?.id;
  const canManageGithub = Boolean(
    project && currentUser && (project.owner_id === currentUser.id || currentUser.is_global_admin)
  );
  const canManageSettings = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "SETTINGS_MANAGE"
  );
  const canUpdateProject = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "PROJECT_UPDATE"
  );
  const canDeleteProject = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "PROJECT_DELETE"
  );
  const canManageRoles = hasProjectPermission(
    project,
    currentUser,
    myMembership,
    "ROLE_MANAGE"
  );
  const canManageAi = Boolean(project && currentUser && project.owner_id === currentUser.id);
  const canTransferOwnership = isProjectOwner;
  const canViewProjectAudit = canManageSettings;
  const canAccessSettingsPage = Boolean(
    canManageSettings ||
    canUpdateProject ||
    canDeleteProject ||
    canManageRoles ||
    canManageGithub ||
    canManageAi ||
    canTransferOwnership
  );

  const selectedRole = useMemo(
    () => roles.find((role) => String(role.id) === selectedRoleId) || roles[0],
    [roles, selectedRoleId]
  );

  const ownershipCandidates = useMemo(
    () => members.filter((member) => member.user.id !== currentUser?.id),
    [currentUser?.id, members]
  );

  const selectedOwnershipMember = useMemo(
    () =>
      ownershipCandidates.find((member) => String(member.user.id) === ownershipTargetUserId) ||
      null,
    [ownershipCandidates, ownershipTargetUserId]
  );

  const loadData = async () => {
    setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = pickWorkspaceProject(projects, currentProject);

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      if (!selectedProject) {
        setProject(null);
        setGithubIntegration(null);
        return;
      }

      const [freshProject, remoteRoles, remoteMembers, nextGitHubIntegration, nextNgrokStatus] = await Promise.all([
        getProjectDetail(selectedProject.id),
        getProjectRoles(selectedProject.id),
        getProjectMembers(selectedProject.id),
        getProjectGitHubIntegration(selectedProject.id).catch(() => null),
        getNgrokTunnelStatus().catch(() => null),
      ]);

      const membership = remoteMembers.find((member) => member.user.id === currentUser?.id);
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
      setMembers(remoteMembers);
      setMemberCount(remoteMembers.length);
      setOwnershipTargetUserId((current) => {
        if (
          current &&
          remoteMembers.some(
            (member) => String(member.user.id) === current && member.user.id !== currentUser?.id
          )
        ) {
          return current;
        }

        const firstCandidate = remoteMembers.find((member) => member.user.id !== currentUser?.id);
        return firstCandidate ? String(firstCandidate.user.id) : "";
      });
      setMyRoleName(membership?.role?.name || "Member");
      setMyMembership(membership || null);
      setAuditLogs(remoteAuditLogs);
      setGithubIntegration(nextGitHubIntegration);
      setNgrokStatus(nextNgrokStatus);
      setGithubRepositoryFullName(nextGitHubIntegration?.repository_full_name || "");
      setGithubRepositoryUrl(nextGitHubIntegration?.repository_url || "");
      setGithubDefaultBranch(nextGitHubIntegration?.default_branch || "main");
      setGithubPublicBaseUrl(
        nextGitHubIntegration?.webhook_url
          ? nextGitHubIntegration.webhook_url.replace(/\/github\/webhook$/, "")
          : nextNgrokStatus?.running && nextNgrokStatus.public_url
            ? nextNgrokStatus.public_url
            : ""
      );
      setGithubAutoLinkCommits(nextGitHubIntegration?.auto_link_commits ?? true);
      setGithubAutoTransitionPrs(nextGitHubIntegration?.auto_transition_prs ?? true);

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
      setAiProvider(freshProject.ai_config?.provider || "OLLAMA");
      setAiProviderName(freshProject.ai_config?.provider_name || "Qwen local (Ollama)");
      setAiBaseUrl(freshProject.ai_config?.base_url || "");
      setAiModel(freshProject.ai_config?.model || "");
      setAiApiKey("");

      if (freshProject.owner_id === currentUser?.id || currentUser?.is_global_admin) {
        const remoteAiSettings = await getProjectAiSettings(freshProject.id);
        setAiConfig(remoteAiSettings);
        setAiMode(remoteAiSettings.mode);
        setAiProvider(remoteAiSettings.provider || "OLLAMA");
        setAiProviderName(remoteAiSettings.provider_name || "Qwen local (Ollama)");
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
    if (!project) return;
    if (!canUpdateProject && !(canManageSettings && methodology !== project.methodology)) return;

    setSavingProject(true);
    try {
      let updated = project;

      if (canUpdateProject) {
        updated = await updateProjectSettings(project.id, {
          name: projectName,
          description,
        });

        setProject(updated);
        setCurrentProject(updated);
      }

      if (canViewProjectAudit) {
        setAuditLogs(await getProjectAuditLogs(updated.id).catch(() => auditLogs));
      }

      if (methodology !== updated.methodology) {
        if (!canManageSettings) {
          toast.error("You do not have permission to change methodology.");
          return;
        }

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

  const handleProjectLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!project || !file) return;
    if (!canUpdateProject) {
      toast.error("You do not have permission to update project identity.");
      return;
    }

    setUploadingProjectLogo(true);
    try {
      const updated = await uploadProjectLogo(project.id, file);
      setProject(updated);
      setCurrentProject(updated);
      if (canViewProjectAudit) {
        setAuditLogs(await getProjectAuditLogs(updated.id).catch(() => auditLogs));
      }
      toast.success("Project icon updated.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not upload project icon."));
    } finally {
      setUploadingProjectLogo(false);
    }
  };

  const handleProjectLogoDelete = async () => {
    if (!project || !project.logo_url) return;
    if (!canUpdateProject) {
      toast.error("You do not have permission to update project identity.");
      return;
    }

    setRemovingProjectLogo(true);
    try {
      const updated = await deleteProjectLogo(project.id);
      setProject(updated);
      setCurrentProject(updated);
      if (canViewProjectAudit) {
        setAuditLogs(await getProjectAuditLogs(updated.id).catch(() => auditLogs));
      }
      toast.success("Project icon removed.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not remove project icon."));
    } finally {
      setRemovingProjectLogo(false);
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
      setWipLimits({
        ...DEFAULT_WIP_LIMITS,
        ...(result.project.workflow_config?.wip_limits || {}),
      });
      setBoardColumns(
        result.project.workflow_config?.columns?.length
          ? result.project.workflow_config.columns
          : DEFAULT_BOARD_COLUMNS
      );
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

    const selectedProvider = aiMode === "PLATFORM" ? "OLLAMA" : aiProvider;
    const usesBaseUrl = selectedProvider === "OPENAI_COMPATIBLE";

    setSavingAiSettings(true);
    try {
      const updated = await updateProjectAiSettings(project.id, {
        mode: aiMode,
        provider: selectedProvider,
        provider_name:
          aiMode === "PLATFORM"
            ? "Qwen local (Ollama)"
            : aiProviderName.trim() || selectedProvider,
        base_url: usesBaseUrl ? aiBaseUrl.trim() : undefined,
        model: aiModel.trim() || undefined,
        // Project-owned keys are write-only: after save we clear the input and rely on
        // `has_project_key` from the API instead of ever rendering the secret again.
        api_key: selectedProvider === "OLLAMA" ? undefined : aiApiKey.trim() || undefined,
        clear_api_key: selectedProvider === "OLLAMA",
      });

      setAiConfig(updated);
      setAiProvider(updated.provider || "OLLAMA");
      setAiProviderName(updated.provider_name || "Qwen local (Ollama)");
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
        provider: "OLLAMA",
        provider_name: "Qwen local (Ollama)",
        model: "qwen2.5-coder:7b",
        clear_api_key: true,
      });
      setAiMode(updated.mode);
      setAiConfig(updated);
      setAiProvider(updated.provider || "OLLAMA");
      setAiProviderName(updated.provider_name || "Qwen local (Ollama)");
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

  const handleSaveGithubSettings = async () => {
    if (!project || !canManageGithub) return;

    if (!githubRepositoryFullName.trim() || !githubRepositoryFullName.includes("/")) {
      toast.error("Repository must use owner/repository format.");
      return;
    }

    const webhookUrl = normalizeGithubWebhookUrl(githubPublicBaseUrl);
    // Demo placeholders must not be persisted because GitHub would silently send
    // webhooks to an unusable URL and make the integration look broken.
    if (
      githubPublicBaseUrl.includes("<ngrok-domain>") ||
      githubPublicBaseUrl.includes("abc123") ||
      webhookUrl.includes("<ngrok-domain>") ||
      webhookUrl.includes("abc123")
    ) {
      toast.error("Use a real public backend/ngrok URL before saving the webhook.");
      return;
    }

    setSavingGithubSettings(true);
    try {
      const saved = await upsertProjectGitHubIntegration(project.id, {
        repository_full_name: githubRepositoryFullName.trim(),
        repository_url: githubRepositoryUrl.trim() || githubRepoUrlFromFullName(githubRepositoryFullName),
        default_branch: githubDefaultBranch.trim() || "main",
        webhook_url: webhookUrl || null,
        auto_link_commits: githubAutoLinkCommits,
        auto_transition_prs: githubAutoTransitionPrs,
      });

      setGithubIntegration(saved);
      setGithubRepositoryFullName(saved.repository_full_name || "");
      setGithubRepositoryUrl(saved.repository_url || "");
      setGithubDefaultBranch(saved.default_branch || "main");
      setGithubPublicBaseUrl(saved.webhook_url ? saved.webhook_url.replace(/\/github\/webhook$/, "") : "");
      setGithubAutoLinkCommits(saved.auto_link_commits);
      setGithubAutoTransitionPrs(saved.auto_transition_prs);
      toast.success("Repository integration saved.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save repository integration."));
    } finally {
      setSavingGithubSettings(false);
    }
  };

  const handleTestGithubSettings = async () => {
    if (!project) return;

    setTestingGithubSettings(true);
    try {
      const result = await testProjectGitHubIntegration(project.id);
      toast[result.status === "CONNECTED" ? "success" : result.status === "ERROR" ? "error" : "info"](
        result.message
      );
      const fresh = await getProjectGitHubIntegration(project.id);
      setGithubIntegration(fresh);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not test repository integration."));
    } finally {
      setTestingGithubSettings(false);
    }
  };

  const handleDisconnectGithubSettings = async () => {
    if (!project || !canManageGithub) return;

    setDisconnectingGithub(true);
    try {
      await deleteProjectGitHubIntegration(project.id);
      setGithubIntegration(null);
      setGithubRepositoryFullName("");
      setGithubRepositoryUrl("");
      setGithubDefaultBranch("main");
      setGithubPublicBaseUrl("");
      setGithubAutoLinkCommits(true);
      setGithubAutoTransitionPrs(true);
      toast.success("Repository integration disconnected.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not disconnect repository integration."));
    } finally {
      setDisconnectingGithub(false);
    }
  };

  const handleStartSettingsNgrok = async () => {
    if (!project || !canManageGithub) return;

    setStartingNgrok(true);
    try {
      const status = await startNgrokTunnel(8000, project.id);
      setNgrokStatus(status);
      if (status.running && status.public_url) {
        setGithubPublicBaseUrl(status.public_url);
        toast.success("ngrok tunnel started and applied.");
      } else {
        toast.error(status.message || "ngrok did not start.");
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not start ngrok."));
    } finally {
      setStartingNgrok(false);
    }
  };

  const handleStopSettingsNgrok = async () => {
    if (!project || !canManageGithub) return;

    setStoppingNgrok(true);
    try {
      const status = await stopNgrokTunnel(project.id);
      setNgrokStatus(status);
      toast.info(status.message || "ngrok stopped.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not stop ngrok."));
    } finally {
      setStoppingNgrok(false);
    }
  };

  const copyGithubWebhook = async () => {
    const value =
      normalizeGithubWebhookUrl(githubPublicBaseUrl) ||
      githubIntegration?.webhook_url ||
      ngrokStatus?.webhook_url ||
      "";

    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Could not copy webhook URL.");
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

    // Keep the permissions UI snappy, but reload from the server if validation fails
    // because methodology-specific rules may normalize the payload.
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

  const handleTransferOwnership = async () => {
    if (!project || !selectedOwnershipMember || !canTransferOwnership) return;

    setTransferringOwnership(true);
    try {
      const result = await transferProjectOwnership(
        project.id,
        selectedOwnershipMember.user.id,
        ownershipConfirmKey
      );

      setProject(result.project);
      setCurrentProject(result.project);
      setOwnershipConfirmKey("");
      toast.success(result.message || "Project ownership transferred.");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not transfer ownership."));
    } finally {
      setTransferringOwnership(false);
    }
  };

  if (loading) {
    return <SettingsLoadingState />;
  }

  if (!project) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  if (!canAccessSettingsPage) {
    return <SettingsUnavailableState />;
  }

  const deleteReady = deleteKey.trim().toUpperCase() === project.key;
  const selectedRoleLocked = selectedRole?.name === "Project Admin";
  const ownershipTransferReady =
    canTransferOwnership &&
    Boolean(selectedOwnershipMember) &&
    ownershipConfirmKey.trim().toUpperCase() === project.key;
  const canSaveProject = canUpdateProject || canManageSettings;
  const projectSaveLabel =
    methodology !== project.methodology && canManageSettings ? "Review change" : "Save changes";
  const accessLabel = isProjectOwner ? "Owner" : myRoleName;

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:p-8">
        <SettingsHero
          project={project}
          isProjectOwner={isProjectOwner}
          canSaveProject={canSaveProject}
          savingProject={savingProject}
          loadingTransition={loadingTransition}
          saveLabel={projectSaveLabel}
          onSave={handleSaveProject}
        />

        <SettingsSummaryCards
          methodology={methodology}
          rolesCount={roles.length}
          memberCount={memberCount}
          accessLabel={accessLabel}
        />

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="space-y-6">
            {(canUpdateProject || canManageSettings) && (
              <SettingsGeneralCard
                project={project}
                projectName={projectName}
                description={description}
                methodology={methodology}
                canUpdateProject={canUpdateProject}
                canManageSettings={canManageSettings}
                uploadingProjectLogo={uploadingProjectLogo}
                removingProjectLogo={removingProjectLogo}
                onProjectNameChange={setProjectName}
                onDescriptionChange={setDescription}
                onMethodologyChange={setMethodology}
                onProjectLogoUpload={handleProjectLogoUpload}
                onProjectLogoDelete={handleProjectLogoDelete}
              />
            )}

            {canManageAi && (
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
                          Use the local Ollama model running through Tailscale, or configure a custom provider only when this project needs one.
                          Use Test provider to verify that the Ollama endpoint is reachable. Custom API keys are encrypted server-side and are never sent back to the browser.
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="w-fit border-violet-400/30 bg-violet-500/10 text-violet-100"
                      >
                        {aiConfig?.mode || "PLATFORM"} · {aiConfig?.provider_name || aiConfig?.provider || "Qwen local (Ollama)"}
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
                      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                        <div className="space-y-2">
                          <Label>AI mode</Label>
                          <Select
                            value={aiMode}
                            onValueChange={(value) => {
                              const nextMode = value as "PLATFORM" | "PROJECT";
                              setAiMode(nextMode);
                              if (nextMode === "PLATFORM") {
                                setAiProvider("OLLAMA");
                                setAiProviderName("Qwen local (Ollama)");
                                setAiBaseUrl("");
                                setAiModel("qwen2.5-coder:7b");
                                setAiApiKey("");
                              } else if (aiProvider === "OLLAMA") {
                                setAiProvider("OPENAI_COMPATIBLE");
                                setAiProviderName("Custom AI");
                                setAiBaseUrl("");
                                setAiModel("gpt-4o-mini");
                              }
                            }}
                          >
                            <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                              <SelectItem value="PLATFORM">Local AI</SelectItem>
                              <SelectItem value="PROJECT">Custom project AI</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                              Local provider
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {aiConfig?.platform_configured ? "Endpoint set" : "Not configured"}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-600">
                              Custom key
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              {aiConfig?.has_project_key ? "Stored encrypted" : "Not added"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {aiMode === "PROJECT" && (
                        <div className="space-y-4">
                          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
                            <div className="space-y-2">
                              <Label>Provider type</Label>
                              <Select
                                value={aiProvider}
                                onValueChange={(value) => {
                                  setAiProvider(value);
                                  setAiProviderName("Custom AI");
                                  setAiModel((current) => current || "gpt-4o-mini");
                                }}
                              >
                                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
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
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
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
            )}

            {canManageGithub && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Github className="h-5 w-5 text-slate-200" />
                    Repository integration
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5 p-5">
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={githubStatusTone(githubIntegration?.setup_status)}>
                          {githubIntegration?.setup_status?.replaceAll("_", " ") || "NOT CONFIGURED"}
                        </Badge>
                        {githubIntegration?.configured && (
                          <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                            One-time setup complete
                          </Badge>
                        )}
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {githubIntegration?.configured
                          ? "Project-level GitHub settings live here. DevOps focuses on events, pull requests and operational visibility."
                          : "Connect a GitHub repository once. After this, SDLC Hub can link commits and pull requests to task keys."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestGithubSettings}
                        disabled={testingGithubSettings || !githubIntegration?.configured}
                        className="h-11 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                      >
                        {testingGithubSettings ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                        )}
                        Check status
                      </Button>

                      <Button
                        type="button"
                        onClick={() => router.push("/dashboard/devops")}
                        className="h-11 shrink-0 bg-slate-100 text-slate-950 hover:bg-white"
                      >
                        <PlugZap className="mr-2 h-4 w-4" />
                        Open DevOps
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Repository</p>
                      <p className="mt-2 truncate font-semibold text-white">
                        {githubIntegration?.repository_full_name || "Not connected"}
                      </p>
                      {githubIntegration?.repository_url && (
                        <a
                          href={githubIntegration.repository_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center text-xs text-blue-300 hover:text-blue-200"
                        >
                          Open on GitHub
                          <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Default branch</p>
                      <p className="mt-2 font-semibold text-white">
                        {githubIntegration?.default_branch || "main"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Last delivery {formatSettingsDate(githubIntegration?.last_delivery_at)}
                      </p>
                    </div>

                    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Webhook</p>
                      <p className="mt-2 truncate font-mono text-sm font-semibold text-white">
                        {githubIntegration?.webhook_url || githubIntegration?.webhook_endpoint_path || "/github/webhook"}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        Secret {githubIntegration?.secret_configured ? githubIntegration.webhook_secret_hint || "configured" : "missing"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-600">Automation</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge className={githubIntegration?.auto_link_commits ? "border-blue-500/30 bg-blue-500/10 text-blue-200" : "border-slate-700 bg-slate-900 text-slate-400"}>
                          Commits {githubIntegration?.auto_link_commits ? "on" : "off"}
                        </Badge>
                        <Badge className={githubIntegration?.auto_transition_prs ? "border-purple-500/30 bg-purple-500/10 text-purple-200" : "border-slate-700 bg-slate-900 text-slate-400"}>
                          PRs {githubIntegration?.auto_transition_prs ? "on" : "off"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {!canManageGithub ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <p className="text-sm font-semibold text-slate-200">Owner-only repository settings</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        You can inspect the current connection, but only the project owner can change repository, webhook and automation settings.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-2">
                          <Label>Repository</Label>
                          <Input
                            value={githubRepositoryFullName}
                            onChange={(event) => {
                              const value = event.target.value;
                              setGithubRepositoryFullName(value);
                              if (!githubRepositoryUrl) {
                                setGithubRepositoryUrl(githubRepoUrlFromFullName(value));
                              }
                            }}
                            placeholder="owner/repository"
                            className="h-11 border-slate-700 bg-slate-900 font-mono text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Default branch</Label>
                          <Input
                            value={githubDefaultBranch}
                            onChange={(event) => setGithubDefaultBranch(event.target.value)}
                            placeholder="main"
                            className="h-11 border-slate-700 bg-slate-900 font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Repository URL</Label>
                          <Input
                            value={githubRepositoryUrl}
                            onChange={(event) => setGithubRepositoryUrl(event.target.value)}
                            placeholder="https://github.com/owner/repository"
                            className="h-11 border-slate-700 bg-slate-900 font-mono text-sm"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Public backend / ngrok URL</Label>
                          <div className="flex gap-2">
                            <Input
                              value={githubPublicBaseUrl}
                              onChange={(event) => setGithubPublicBaseUrl(event.target.value)}
                              placeholder="https://abc123.ngrok-free.app"
                              className="h-11 border-slate-700 bg-slate-900 font-mono text-sm"
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={copyGithubWebhook}
                              disabled={!normalizeGithubWebhookUrl(githubPublicBaseUrl) && !githubIntegration?.webhook_url && !ngrokStatus?.webhook_url}
                              className="h-11 w-11 shrink-0 border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs leading-5 text-slate-500">
                            Payload URL:{" "}
                            <span className="font-mono text-slate-300">
                              {normalizeGithubWebhookUrl(githubPublicBaseUrl) || githubIntegration?.webhook_url || ngrokStatus?.webhook_url || "/github/webhook"}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setGithubAutoLinkCommits((value) => !value)}
                          className={
                            githubAutoLinkCommits
                              ? "rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-left transition hover:bg-blue-500/15"
                              : "rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-slate-700"
                          }
                        >
                          <p className="font-semibold text-white">Auto-link commits</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Commit messages containing task keys are posted to comments and audit logs.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setGithubAutoTransitionPrs((value) => !value)}
                          className={
                            githubAutoTransitionPrs
                              ? "rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 text-left transition hover:bg-purple-500/15"
                              : "rounded-2xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-slate-700"
                          }
                        >
                          <p className="font-semibold text-white">PR smart transitions</p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Pull request activity can move or suggest moving tasks through Review/Done.
                          </p>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Server className="h-4 w-4 text-emerald-300" />
                              <p className="font-semibold text-white">ngrok setup tunnel</p>
                            </div>
                            <p className="mt-2 break-words text-sm leading-6 text-slate-500">
                              {ngrokStatus?.running
                                ? `Running at ${ngrokStatus.public_url}`
                                : ngrokStatus?.message || "ngrok is not running."}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              onClick={handleStartSettingsNgrok}
                              disabled={startingNgrok}
                              className="h-10 bg-emerald-600 text-white hover:bg-emerald-500"
                            >
                              {startingNgrok ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Server className="mr-2 h-4 w-4" />
                              )}
                              Start
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={handleStopSettingsNgrok}
                              disabled={stoppingNgrok}
                              className="h-10 border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
                            >
                              {stoppingNgrok ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="mr-2 h-4 w-4" />
                              )}
                              Stop
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button
                          type="button"
                          onClick={handleSaveGithubSettings}
                          disabled={savingGithubSettings}
                          className="h-11 bg-blue-600 text-white hover:bg-blue-500"
                        >
                          {savingGithubSettings ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save repository settings
                        </Button>

                        {githubIntegration?.configured && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleDisconnectGithubSettings}
                            disabled={disconnectingGithub}
                            className="h-11 border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                          >
                            {disconnectingGithub ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Disconnect repository
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canManageSettings && (
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
                          className="grid min-w-0 gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4 lg:grid-cols-[140px_minmax(0,1fr)] 2xl:grid-cols-[140px_minmax(0,1fr)_260px]"
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
                            className="h-10 min-w-0 border-slate-700 bg-slate-900"
                          />

                          <div className="flex flex-wrap items-center gap-2 lg:col-span-2 2xl:col-span-1 2xl:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={index === 0}
                              onClick={() => moveBoardColumn(column.key, -1)}
                              className="h-9 border-slate-700 bg-slate-900 px-3 text-slate-300 hover:bg-slate-800"
                            >
                              Up
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={index === orderedColumns.length - 1}
                              onClick={() => moveBoardColumn(column.key, 1)}
                              className="h-9 border-slate-700 bg-slate-900 px-3 text-slate-300 hover:bg-slate-800"
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
                                  ? "h-9 border-emerald-500/30 bg-emerald-500/10 px-3 text-emerald-100 hover:bg-emerald-500/15"
                                  : "h-9 border-slate-700 bg-slate-900 px-3 text-slate-400 hover:bg-slate-800"
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
            )}

            {canManageRoles && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5 text-purple-300" />
                    Role permissions
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5 p-5">
                  <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
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
                                  className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${enabled && !disabledByMethodology
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
            )}
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

            {canTransferOwnership && (
              <Card className="border-amber-500/25 bg-amber-500/10 text-slate-50">
                <CardHeader className="border-b border-amber-500/20">
                  <CardTitle className="flex items-center gap-2 text-base text-amber-100">
                    <Crown className="h-5 w-5 text-amber-300" />
                    Transfer ownership
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="rounded-2xl border border-amber-500/20 bg-slate-950/70 p-4">
                    <p className="text-sm leading-6 text-amber-100/85">
                      The transfer changes the owner of the project. You remain a member of the project,
                      but the new owner receives the ownership.
                    </p>
                  </div>

                  {ownershipCandidates.length > 0 ? (
                    <>
                      <div className="space-y-2">
                        <Label>New owner</Label>
                        <Select
                          value={ownershipTargetUserId}
                          onValueChange={setOwnershipTargetUserId}
                        >
                          <SelectTrigger className="h-11 border-amber-500/25 bg-slate-950">
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            {ownershipCandidates.map((member) => (
                              <SelectItem key={member.membership_id} value={String(member.user.id)}>
                                {member.user.full_name || member.user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedOwnershipMember && (
                          <p className="text-xs leading-5 text-slate-500">
                            {selectedOwnershipMember.user.email} · {selectedOwnershipMember.role?.name || "Member"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>
                          Type project key:{" "}
                          <span className="font-mono text-amber-200">{project.key}</span>
                        </Label>
                        <Input
                          value={ownershipConfirmKey}
                          onChange={(event) => setOwnershipConfirmKey(event.target.value)}
                          placeholder={project.key}
                          className="h-11 border-amber-500/25 bg-slate-950 font-mono"
                        />
                      </div>

                      <Button
                        type="button"
                        onClick={handleTransferOwnership}
                        disabled={!ownershipTransferReady || transferringOwnership}
                        className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {transferringOwnership ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Crown className="mr-2 h-4 w-4" />
                        )}
                        Transfer ownership
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-amber-500/25 bg-slate-950/70 p-4 text-sm leading-6 text-slate-400">
                      Invite another member first, then return here to transfer ownership.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {canViewProjectAudit && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <History className="h-5 w-5 text-violet-300" />
                    Project audit trail
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 p-5">
                  {auditLogs.slice(0, 8).map((log) => (
                    <AuditLogEvent key={log.id} event={log} compact />
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
            )}

            {canDeleteProject && (
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
            )}
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
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-3xl">
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
              <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
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
