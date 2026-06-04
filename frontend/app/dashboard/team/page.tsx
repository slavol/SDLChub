"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Crown,
  GitBranch,
  Loader2,
  Mail,
  Network,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wifi,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WorkspaceLoadingSkeleton } from "@/components/dashboard/workspace-loading-skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserAvatar } from "@/components/user-avatar";
import { useDebouncedRealtimeEvent } from "@/hooks/use-realtime-event";
import { hasProjectPermission } from "@/lib/project-permissions";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  cancelProjectInvitation,
  createProjectTeam,
  deleteProjectTeam,
  createProjectRole,
  deleteProjectRole,
  getMyProjects,
  getProjectInvitations,
  getProjectMembers,
  getProjectRoles,
  getProjectTeams,
  inviteProjectMember,
  PendingInvitation,
  ProjectMember,
  ProjectTeam,
  ProjectRoleWithPermissions,
  removeProjectMember,
  resendProjectInvitation,
  updateProjectMemberTeam,
  updateProjectMemberRole,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { usePresenceStore } from "@/store/use-presence-store";
import { useProjectStore } from "@/store/use-project-store";

const DEFAULT_ROLE_PERMISSIONS: Record<string, boolean> = {
  TASK_CREATE: true,
  TASK_UPDATE: true,
  TASK_ASSIGN: true,
  TASK_COMMENT: true,
  TASK_MOVE: true,
  TEAM_MANAGE: false,
  SPRINT_CREATE: false,
  SPRINT_START: false,
  SPRINT_CLOSE: false,
  AI_USE: true,
  REPORT_VIEW: true,
  CALENDAR_CREATE: true,
  CALENDAR_UPDATE: false,
  CALENDAR_DELETE: false,
};

const EMPTY_ONLINE_USER_IDS: number[] = [];

function roleBadgeClass(role?: string | null) {
  if (role === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (role?.includes("Owner") || role?.includes("Manager")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (role?.includes("Lead") || role?.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

type TeamConfirmAction =
  | { type: "deleteRole"; role: ProjectRoleWithPermissions }
  | { type: "deleteTeam"; team: ProjectTeam }
  | { type: "removeMember"; membership: ProjectMember }
  | { type: "cancelInvite"; invitationId: number };

export default function TeamPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [projectId, setProjectId] = useState<number | null>(currentProject?.id ?? null);
  const [projectOwnerId, setProjectOwnerId] = useState<number | null>(currentProject?.owner_id ?? null);
  const [projectName, setProjectName] = useState(currentProject?.name ?? "");

  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [roles, setRoles] = useState<ProjectRoleWithPermissions[]>([]);
  const [teams, setTeams] = useState<ProjectTeam[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDescription, setNewTeamDescription] = useState("");
  const [newTeamParentId, setNewTeamParentId] = useState("root");

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [roleFilter, setRoleFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TeamConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const onlineUserIds = usePresenceStore((state) =>
    projectId ? state.onlineByProject[projectId] || EMPTY_ONLINE_USER_IDS : EMPTY_ONLINE_USER_IDS
  );

  const onlineUserIdSet = useMemo(() => new Set(onlineUserIds), [onlineUserIds]);
  const onlineMembersCount = useMemo(
    () => members.filter((member) => onlineUserIdSet.has(member.user.id)).length,
    [members, onlineUserIdSet]
  );

  const myMembership = useMemo(
    () => members.find((member) => member.user.id === currentUser?.id),
    [members, currentUser?.id]
  );

  const isProjectOwner = currentUser?.id === projectOwnerId;

  const canInviteMembers = hasProjectPermission(
    currentProject,
    currentUser,
    myMembership,
    "MEMBER_INVITE"
  );
  const canRemoveMembers = hasProjectPermission(
    currentProject,
    currentUser,
    myMembership,
    "MEMBER_REMOVE"
  );
  const canManageRoles = hasProjectPermission(
    currentProject,
    currentUser,
    myMembership,
    "ROLE_MANAGE"
  );
  const canManageTeams = hasProjectPermission(
    currentProject,
    currentUser,
    myMembership,
    "TEAM_MANAGE"
  );
  const pendingInvites = useMemo(
    () => invitations.filter((invite) => invite.status === "PENDING"),
    [invitations]
  );

  const roleUsage = useMemo(() => {
    const usage: Record<number, number> = {};
    for (const role of roles) usage[role.id] = 0;
    for (const member of members) {
      if (member.role?.id) usage[member.role.id] = (usage[member.role.id] || 0) + 1;
    }
    return usage;
  }, [members, roles]);

  const inviteUsage = useMemo(() => {
    const usage: Record<number, number> = {};
    for (const role of roles) usage[role.id] = 0;
    for (const invite of pendingInvites) {
      usage[invite.role_id] = (usage[invite.role_id] || 0) + 1;
    }
    return usage;
  }, [pendingInvites, roles]);

  const teamNameById = useMemo(() => {
    const names: Record<number, string> = {};
    for (const team of teams) names[team.id] = team.name;
    return names;
  }, [teams]);

  const rootTeams = useMemo(
    () => teams.filter((team) => !team.parent_id),
    [teams]
  );

  const childTeamsByParent = useMemo(() => {
    const children: Record<number, ProjectTeam[]> = {};
    for (const team of teams) {
      if (!team.parent_id) continue;
      children[team.parent_id] = [...(children[team.parent_id] || []), team];
    }
    return children;
  }, [teams]);

  const membersByTeam = useMemo(() => {
    const grouped: Record<number, ProjectMember[]> = {};
    for (const member of members) {
      if (!member.team?.id) continue;
      grouped[member.team.id] = [...(grouped[member.team.id] || []), member];
    }
    return grouped;
  }, [members]);

  const myTeam = useMemo(
    () => teams.find((team) => team.id === myMembership?.team?.id) || myMembership?.team || null,
    [myMembership?.team, teams]
  );

  const myTeamMembers = useMemo(
    () => (myTeam?.id ? membersByTeam[myTeam.id] || [] : []),
    [membersByTeam, myTeam?.id]
  );

  const myTeamChildren = useMemo(
    () => (myTeam?.id ? childTeamsByParent[myTeam.id] || [] : []),
    [childTeamsByParent, myTeam?.id]
  );

  const isTeamLeadershipRole = Boolean(
    isProjectOwner ||
      ["Project Admin", "Project Manager", "Product Owner", "Scrum Master", "Flow Manager", "Tech Lead"].some(
        (role) => (myMembership?.role?.name || "").includes(role)
      )
  );

  const filteredMembers = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();

    return members.filter((member) => {
      const roleId = member.role?.id ? String(member.role.id) : "";
      const roleName = member.role?.name || "Member";

      if (roleFilter !== "all" && roleFilter !== roleId) return false;

      if (!q) return true;

      return [
        member.user.full_name || "",
        member.user.email,
        roleName,
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [deferredSearch, members, roleFilter]);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

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
        setProjectId(null);
        return;
      }

      setProjectId(selectedProject.id);
      setProjectOwnerId(selectedProject.owner_id);
      setProjectName(selectedProject.name);

      const [remoteMembers, remoteRoles, remoteTeams] = await Promise.all([
        getProjectMembers(selectedProject.id),
        getProjectRoles(selectedProject.id),
        getProjectTeams(selectedProject.id),
      ]);

      setMembers(remoteMembers);
      setRoles(remoteRoles);
      setTeams(remoteTeams);

      if (remoteRoles.length > 0) {
        const defaultRole =
          remoteRoles.find((role) => role.name !== "Project Admin") || remoteRoles[0];
        setInviteRoleId((current) => current || String(defaultRole.id));
      }

      try {
        const remoteInvitations = await getProjectInvitations(selectedProject.id);
        setInvitations(remoteInvitations);
      } catch {
        setInvitations([]);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load team data."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentProject, setCurrentProject]);

  useEffect(() => {
    loadData();
  }, [loadData, currentUser?.id]);

  useDebouncedRealtimeEvent(
    () => loadData(false),
    [loadData, projectId],
    350,
    (message) => {
      if (!projectId || (message.project_id && message.project_id !== projectId)) return false;
      return message.type === "user.updated" || message.type === "project.changed";
    }
  );

  const handleInvite = async () => {
    if (!projectId || !inviteEmail.trim() || !inviteRoleId) return;

    setInviting(true);
    try {
      await inviteProjectMember(projectId, {
        email: inviteEmail.trim(),
        role_id: Number(inviteRoleId),
      });

      setInviteEmail("");
      toast.success("Invitation sent");
      await loadData(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not send invitation."));
    } finally {
      setInviting(false);
    }
  };

  const handleCreateRole = async () => {
    if (!projectId || !newRoleName.trim()) return;

    setCreatingRole(true);
    try {
      await createProjectRole(projectId, {
        name: newRoleName.trim(),
        description: newRoleDescription.trim() || null,
        permissions: DEFAULT_ROLE_PERMISSIONS,
      });

      setNewRoleName("");
      setNewRoleDescription("");
      toast.success("Role created");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not create role."));
    } finally {
      setCreatingRole(false);
    }
  };

  const handleCreateTeam = async () => {
    if (!projectId || !newTeamName.trim()) return;

    setCreatingTeam(true);
    try {
      await createProjectTeam(projectId, {
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || null,
        parent_id: newTeamParentId === "root" ? null : Number(newTeamParentId),
      });

      setNewTeamName("");
      setNewTeamDescription("");
      setNewTeamParentId("root");
      toast.success("Team created");
      await loadData(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not create team."));
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleDeleteTeam = (team: ProjectTeam) => {
    if (!projectId) return;
    setConfirmAction({ type: "deleteTeam", team });
  };

  const executeDeleteTeam = async (team: ProjectTeam) => {
    try {
      await deleteProjectTeam(team.id);
      toast.success("Team deleted");
      await loadData(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete team."));
    }
  };

  const handleChangeMemberTeam = async (membershipId: number, teamId: string) => {
    if (!projectId) return;

    try {
      await updateProjectMemberTeam(
        projectId,
        membershipId,
        teamId === "none" ? null : Number(teamId)
      );
      toast.success("Team assignment updated");
      await loadData(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update member team."));
    }
  };

  const handleDeleteRole = async (role: ProjectRoleWithPermissions) => {
    if (!projectId) return;
    if (role.name === "Project Admin") return;
    setConfirmAction({ type: "deleteRole", role });
  };

  const executeDeleteRole = async (role: ProjectRoleWithPermissions) => {
    if (!projectId) return;

    try {
      await deleteProjectRole(projectId, role.id);
      toast.success("Role deleted");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete role."));
    }
  };

  const handleChangeRole = async (membershipId: number, roleId: string) => {
    if (!projectId) return;

    try {
      await updateProjectMemberRole(projectId, membershipId, Number(roleId));
      toast.success("Role updated");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update role."));
    }
  };

  const handleRemoveMember = async (membership: ProjectMember) => {
    if (!projectId) return;
    setConfirmAction({ type: "removeMember", membership });
  };

  const executeRemoveMember = async (membership: ProjectMember) => {
    if (!projectId) return;

    try {
      await removeProjectMember(projectId, membership.membership_id);
      toast.success("Member removed");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not remove member."));
    }
  };

  const handleResendInvite = async (invitationId: number) => {
    if (!projectId) return;

    try {
      await resendProjectInvitation(projectId, invitationId);
      toast.success("Invitation resent");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not resend invitation."));
    }
  };

  const handleCancelInvite = async (invitationId: number) => {
    if (!projectId) return;
    setConfirmAction({ type: "cancelInvite", invitationId });
  };

  const executeCancelInvite = async (invitationId: number) => {
    if (!projectId) return;

    try {
      await cancelProjectInvitation(projectId, invitationId);
      toast.success("Invitation cancelled");
      await loadData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not cancel invitation."));
    }
  };

  const confirmCopy = (() => {
    if (!confirmAction) {
      return {
        title: "",
        description: "",
        confirmLabel: "Confirm",
      };
    }

    if (confirmAction.type === "deleteRole") {
      return {
        title: `Delete role "${confirmAction.role.name}"?`,
        description: "This removes the role from this project. Members and invitations must be moved before deletion.",
        confirmLabel: "Delete Role",
      };
    }

    if (confirmAction.type === "deleteTeam") {
      return {
        title: `Delete team "${confirmAction.team.name}"?`,
        description: "Members, tasks and child teams will be detached, but they will not be deleted.",
        confirmLabel: "Delete Team",
      };
    }

    if (confirmAction.type === "removeMember") {
      return {
        title: "Remove member?",
        description: `${confirmAction.membership.user.full_name || confirmAction.membership.user.email} will lose access to this project.`,
        confirmLabel: "Remove Member",
      };
    }

    return {
      title: "Cancel invitation?",
      description: "This invitation code will no longer be usable.",
      confirmLabel: "Cancel Invitation",
    };
  })();

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    setConfirmLoading(true);
    try {
      if (confirmAction.type === "deleteRole") {
        await executeDeleteRole(confirmAction.role);
      } else if (confirmAction.type === "deleteTeam") {
        await executeDeleteTeam(confirmAction.team);
      } else if (confirmAction.type === "removeMember") {
        await executeRemoveMember(confirmAction.membership);
      } else {
        await executeCancelInvite(confirmAction.invitationId);
      }

      setConfirmAction(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const renderTeamTreeNode = (team: ProjectTeam, depth = 0) => {
    const children = childTeamsByParent[team.id] || [];
    const teamMembers = membersByTeam[team.id] || [];
    const isMyTeam = myTeam?.id === team.id;

    return (
      <div key={team.id} className={depth > 0 ? "relative border-l border-slate-800 pl-4" : ""}>
        {depth > 0 && (
          <span className="absolute left-0 top-6 h-px w-4 bg-slate-800" />
        )}
        <div
          className={cn(
            "rounded-2xl border bg-slate-950 p-4",
            isMyTeam ? "border-cyan-400/40 shadow-lg shadow-cyan-950/20" : "border-slate-800"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <GitBranch className="h-4 w-4 text-cyan-300" />
                <p className="truncate font-semibold text-white">{team.name}</p>
                {isMyTeam && (
                  <Badge className="bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                    My team
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {team.description || "No description"}
              </p>
            </div>
            {canManageTeams && (
              <Button
                variant="ghost"
                className="h-8 w-8 p-0 text-slate-500 hover:bg-red-950/30 hover:text-red-400"
                onClick={() => handleDeleteTeam(team)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-500">Members</p>
              <p className="mt-1 text-lg font-bold text-white">{team.member_count}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <p className="text-xs text-slate-500">Assigned tasks</p>
              <p className="mt-1 text-lg font-bold text-white">{team.task_count}</p>
            </div>
          </div>

          {teamMembers.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {teamMembers.slice(0, 6).map((member) => (
                <div
                  key={member.membership_id}
                  className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-2 py-1"
                >
                  <UserAvatar
                    name={member.user.full_name}
                    email={member.user.email}
                    src={member.user.avatar_url}
                    className="h-6 w-6"
                    fallbackClassName="text-[9px]"
                  />
                  <span className="max-w-32 truncate text-xs text-slate-300">
                    {member.user.full_name || member.user.email}
                  </span>
                </div>
              ))}
              {teamMembers.length > 6 && (
                <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-400">
                  +{teamMembers.length - 6}
                </Badge>
              )}
            </div>
          )}
        </div>

        {children.length > 0 && (
          <div className="mt-3 space-y-3">
            {children.map((child) => renderTeamTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <WorkspaceLoadingSkeleton metricCount={6} panelCount={2} tableRows={4} withSidePanel />;
  }

  if (!projectId) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 lg:p-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                  {projectName}
                </Badge>
                {isProjectOwner && (
                  <Badge className="bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
                    <Crown className="mr-1 h-3 w-3" />
                    Project Owner
                  </Badge>
                )}
              </div>

              <h1 className="mt-4 break-words text-2xl font-black tracking-tight text-white sm:text-3xl md:text-4xl">
                Team management
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage members, roles and invitations for this project.
              </p>
            </div>

          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-blue-500/10 p-3 text-blue-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Members</p>
                <p className="text-2xl font-bold">{members.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
                <Wifi className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Online now</p>
                <p className="text-2xl font-bold">{onlineMembersCount}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-purple-500/10 p-3 text-purple-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Roles</p>
                <p className="text-2xl font-bold">{roles.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-cyan-500/10 p-3 text-cyan-300">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Teams</p>
                <p className="text-2xl font-bold">{teams.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-300">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Pending invites</p>
                <p className="text-2xl font-bold">{pendingInvites.length}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="min-w-0 border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300">
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-slate-400">Your role</p>
                <p className="truncate text-lg font-bold">{isProjectOwner ? "Owner" : myMembership?.role?.name || "Member"}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-50">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <Network className="h-4 w-4" />
                Team hierarchy
              </div>
              <h2 className="text-xl font-bold text-white">Project organization</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Structure members into teams and subteams, then assign work to the right delivery group.
              </p>
            </div>
          </div>

          {canManageTeams && (
            <div className="mb-5 grid min-w-0 gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto]">
              <Input
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Team name"
                className="h-11 border-slate-700 bg-slate-950"
              />
              <Input
                value={newTeamDescription}
                onChange={(event) => setNewTeamDescription(event.target.value)}
                placeholder="Short description"
                className="h-11 border-slate-700 bg-slate-950"
              />
              <Select value={newTeamParentId} onValueChange={setNewTeamParentId}>
                <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                  <SelectItem value="root">Root team</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={String(team.id)}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={handleCreateTeam}
                disabled={creatingTeam || !newTeamName.trim()}
                className="h-11 w-full bg-cyan-600 hover:bg-cyan-700 lg:w-auto"
              >
                {creatingTeam ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add team
              </Button>
            </div>
          )}

          {isTeamLeadershipRole && (
            <div className="mb-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-cyan-100">
                    <Users className="h-4 w-4" />
                    My team view
                  </div>
                  <p className="text-xl font-bold text-white">
                    {myTeam ? myTeam.name : "No delivery team assigned"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-cyan-100/70">
                    {myTeam
                      ? `${myTeamMembers.length} direct members, ${myTeamChildren.length} subteams and ${myTeam.task_count} assigned tasks.`
                      : "Assign yourself to a team to get a focused leadership view here."}
                  </p>
                </div>

                {myTeam && (
                  <div className="flex flex-wrap gap-2">
                    {myTeamMembers.slice(0, 8).map((member) => (
                      <UserAvatar
                        key={member.membership_id}
                        name={member.user.full_name}
                        email={member.user.email}
                        src={member.user.avatar_url}
                        className="h-10 w-10 border-cyan-400/20"
                        fallbackClassName="text-xs"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rootTeams.map((team) => renderTeamTreeNode(team))}

            {teams.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                <Network className="mx-auto mb-3 h-8 w-8 text-slate-600" />
                <p className="text-sm text-slate-500">No teams created yet.</p>
              </div>
            )}
          </div>
        </section>

        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-6">
            {canInviteMembers && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-5 w-5 text-blue-300" />
                    Invite a teammate
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid min-w-0 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px_auto] lg:items-end">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleInvite()}
                      placeholder="teammate@company.com"
                      className="h-11 border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
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

                  <Button
                    onClick={handleInvite}
                    disabled={inviting || !inviteEmail.trim() || !inviteRoleId}
                    className="h-11 w-full bg-blue-600 px-5 hover:bg-blue-700 lg:w-auto"
                  >
                    {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                    Send invitation
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-5 w-5 text-emerald-300" />
                    Members
                  </CardTitle>

                  <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
                    <div className="relative min-w-0">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search"
                        className="h-10 w-full border-slate-700 bg-slate-950 pl-9 lg:w-64"
                      />
                    </div>

                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-10 w-full border-slate-700 bg-slate-950 lg:w-52">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                        <SelectItem value="all">All roles</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 p-5">
                {filteredMembers.map((member) => {
                  const isSelf = member.user.id === currentUser?.id;
                  const isOwner = member.user.id === projectOwnerId;
                  const isOnline = onlineUserIdSet.has(member.user.id);
                  const roleName = member.role?.name || "Member";

                  return (
                    <div
                      key={member.membership_id}
                      className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="relative shrink-0">
                          <UserAvatar
                            name={member.user.full_name}
                            email={member.user.email}
                            src={member.user.avatar_url}
                            className="h-11 w-11 rounded-2xl border-slate-800"
                            fallbackClassName="text-sm font-bold"
                          />
                          <span
                            className={
                              isOnline
                                ? "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-emerald-400"
                                : "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 bg-slate-700"
                            }
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-white">
                              {member.user.full_name || member.user.email}
                            </p>
                            {isOwner && (
                              <Badge className="bg-amber-500/10 text-amber-300 hover:bg-amber-500/10">
                                Owner
                              </Badge>
                            )}
                            {isSelf && (
                              <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                                You
                              </Badge>
                            )}
                            {isOnline && (
                              <Badge className="bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10">
                                Online
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="grid min-w-0 gap-2 sm:grid-cols-2 md:flex md:flex-wrap md:items-center md:justify-end">
                        {canManageTeams ? (
                          <Select
                            value={member.team?.id ? String(member.team.id) : "none"}
                            onValueChange={(value) => handleChangeMemberTeam(member.membership_id, value)}
                          >
                            <SelectTrigger className="w-full border-slate-700 bg-slate-900 md:w-[190px]">
                              <SelectValue placeholder="No team" />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                              <SelectItem value="none">No team</SelectItem>
                              {teams.map((team) => (
                                <SelectItem key={team.id} value={String(team.id)}>
                                  {team.parent_id ? `${teamNameById[team.parent_id] || "Team"} / ${team.name}` : team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : member.team ? (
                          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                            {member.team.name}
                          </Badge>
                        ) : null}

                        {canManageRoles && !isOwner ? (
                          <Select
                            value={member.role?.id ? String(member.role.id) : ""}
                            onValueChange={(value) => handleChangeRole(member.membership_id, value)}
                          >
                            <SelectTrigger className="w-full border-slate-700 bg-slate-900 md:w-[220px]">
                              <SelectValue placeholder="No role" />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                              {roles.map((role) => (
                                <SelectItem key={role.id} value={String(role.id)}>
                                  {role.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className={roleBadgeClass(roleName)}>
                            {roleName}
                          </Badge>
                        )}

                        {canRemoveMembers && !isSelf && !isOwner && (
                          <Button
                            variant="ghost"
                            className="text-slate-500 hover:bg-red-950/30 hover:text-red-400"
                            onClick={() => handleRemoveMember(member)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredMembers.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                    No members found.
                  </div>
                )}
              </CardContent>
            </Card>

            {canInviteMembers && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Mail className="h-5 w-5 text-amber-300" />
                    Pending invitations
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-3 p-5">
                  {pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-white">{invite.email}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={roleBadgeClass(invite.role_name)}>
                            {invite.role_name}
                          </Badge>
                          <span className="font-mono text-xs text-slate-500">{invite.code}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="border-slate-700"
                          onClick={() => handleResendInvite(invite.id)}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resend
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-red-400 hover:bg-red-950/30"
                          onClick={() => handleCancelInvite(invite.id)}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}

                  {pendingInvites.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                      No pending invitations.
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          <aside className="space-y-6">
            {canManageRoles && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-5 w-5 text-purple-300" />
                    New role
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4 p-5">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newRoleName}
                      onChange={(event) => setNewRoleName(event.target.value)}
                      placeholder="QA Engineer"
                      className="h-11 border-slate-700 bg-slate-950"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newRoleDescription}
                      onChange={(event) => setNewRoleDescription(event.target.value)}
                      placeholder="Responsible for validation and testing."
                      className="min-h-24 border-slate-700 bg-slate-950"
                    />
                  </div>

                  <Button
                    onClick={handleCreateRole}
                    disabled={creatingRole || !newRoleName.trim()}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {creatingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                    Create role
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-800 bg-slate-900 text-slate-50">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-blue-300" />
                  Roles
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-3 p-5">
                {roles.map((role) => {
                  const membersUsingRole = roleUsage[role.id] || 0;
                  const invitesUsingRole = inviteUsage[role.id] || 0;
                  const canDelete =
                    canManageRoles &&
                    role.name !== "Project Admin" &&
                    membersUsingRole === 0 &&
                    invitesUsingRole === 0;

                  return (
                    <div key={role.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-white">{role.name}</p>
                            {role.name === "Project Admin" && (
                              <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                                Locked
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {role.description || "No description"}
                          </p>
                        </div>

                        {canManageRoles && role.name !== "Project Admin" && (
                          <Button
                            variant="ghost"
                            disabled={!canDelete}
                            className="text-slate-500 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-30"
                            onClick={() => handleDeleteRole(role)}
                            title={
                              canDelete
                                ? "Delete role"
                                : "Move members and cancel invites before deleting this role"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Members</p>
                          <p className="mt-1 text-lg font-bold text-white">{membersUsingRole}</p>
                        </div>
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                          <p className="text-xs text-slate-500">Invites</p>
                          <p className="mt-1 text-lg font-bold text-white">{invitesUsingRole}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </aside>
        </section>
      </div>
      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        destructive
        loading={confirmLoading}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
}
