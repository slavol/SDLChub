"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Crown,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { getApiErrorMessage } from "@/lib/api-error";
import {
  cancelProjectInvitation,
  createProjectRole,
  deleteProjectRole,
  getMyProjects,
  getProjectInvitations,
  getProjectMembers,
  getProjectRoles,
  inviteProjectMember,
  PendingInvitation,
  ProjectMember,
  ProjectRoleWithPermissions,
  removeProjectMember,
  resendProjectInvitation,
  updateProjectMemberRole,
} from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

const DEFAULT_ROLE_PERMISSIONS: Record<string, boolean> = {
  TASK_CREATE: true,
  TASK_UPDATE: true,
  TASK_COMMENT: true,
  TASK_MOVE: true,
  AI_USE: true,
  REPORT_VIEW: true,
};

function initials(name?: string | null, email?: string) {
  const source = name || email || "User";
  return source
    .split(/[ .@_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roleBadgeClass(role?: string | null) {
  if (role === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (role?.includes("Owner") || role?.includes("Manager")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (role?.includes("Lead") || role?.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

type TeamConfirmAction =
  | { type: "deleteRole"; role: ProjectRoleWithPermissions }
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
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleId, setInviteRoleId] = useState("");

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [confirmAction, setConfirmAction] = useState<TeamConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const myMembership = useMemo(
    () => members.find((member) => member.user.id === currentUser?.id),
    [members, currentUser?.id]
  );

  const isProjectOwner = currentUser?.id === projectOwnerId;

  const canManageTeam = useMemo(() => {
    const roleName = myMembership?.role?.name;
    return (
      isProjectOwner ||
      [
        "Project Admin",
        "Project Manager",
        "Product Owner",
        "Scrum Master",
        "Flow Manager",
        "Tech Lead",
      ].includes(roleName || "")
    );
  }, [isProjectOwner, myMembership?.role?.name]);

  const canManageRoles = useMemo(() => {
    const roleName = myMembership?.role?.name;
    return isProjectOwner || roleName === "Project Admin";
  }, [isProjectOwner, myMembership?.role?.name]);

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

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();

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
  }, [members, roleFilter, search]);

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
        setProjectId(null);
        return;
      }

      setProjectId(selectedProject.id);
      setProjectOwnerId(selectedProject.owner_id);
      setProjectName(selectedProject.name);

      const [remoteMembers, remoteRoles] = await Promise.all([
        getProjectMembers(selectedProject.id),
        getProjectRoles(selectedProject.id),
      ]);

      setMembers(remoteMembers);
      setRoles(remoteRoles);

      if (!inviteRoleId && remoteRoles.length > 0) {
        const defaultRole =
          remoteRoles.find((role) => role.name !== "Project Admin") || remoteRoles[0];
        setInviteRoleId(String(defaultRole.id));
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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProject?.id, currentUser?.id]);

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
      await loadData();
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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-950 text-blue-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!projectId) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
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

              <h1 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">
                Team management
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Manage members, roles and invitations for this project.
              </p>
            </div>

            {canManageTeam && (
              <Button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim() || !inviteRoleId}
                className="h-11 bg-blue-600 px-5 hover:bg-blue-700"
              >
                {inviting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                Send invitation
              </Button>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-800 bg-slate-900 text-slate-50">
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

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
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

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
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

          <Card className="border-slate-800 bg-slate-900 text-slate-50">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="rounded-2xl bg-amber-500/10 p-3 text-amber-300">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Your role</p>
                <p className="text-lg font-bold">{isProjectOwner ? "Owner" : myMembership?.role?.name || "Member"}</p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-6">
            {canManageTeam && (
              <Card className="border-slate-800 bg-slate-900 text-slate-50">
                <CardHeader className="border-b border-slate-800">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <UserPlus className="h-5 w-5 text-blue-300" />
                    Invite a teammate
                  </CardTitle>
                </CardHeader>

                <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_260px]">
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

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search"
                        className="h-10 border-slate-700 bg-slate-950 pl-9 sm:w-64"
                      />
                    </div>

                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="h-10 border-slate-700 bg-slate-950 sm:w-52">
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
                  const roleName = member.role?.name || "Member";

                  return (
                    <div
                      key={member.membership_id}
                      className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950 p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-sm font-bold text-slate-200">
                          {initials(member.user.full_name, member.user.email)}
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
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-500">{member.user.email}</p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        {canManageTeam && !isOwner ? (
                          <Select
                            value={member.role?.id ? String(member.role.id) : ""}
                            onValueChange={(value) => handleChangeRole(member.membership_id, value)}
                          >
                            <SelectTrigger className="w-full border-slate-700 bg-slate-900 sm:w-[220px]">
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

                        {canManageTeam && !isSelf && !isOwner && (
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

            {canManageTeam && (
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
