"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
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
  deleteProject,
  getMyProjects,
  getProjectDetail,
  getProjectMembers,
  getProjectRoles,
  Project,
  ProjectRoleWithPermissions,
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
    keys: ["MEMBER_INVITE", "MEMBER_REMOVE", "ROLE_MANAGE"],
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
  TASK_CREATE: "Create tasks",
  TASK_UPDATE: "Update tasks",
  TASK_DELETE: "Delete tasks",
  TASK_ASSIGN: "Assign tasks",
  TASK_MOVE: "Move tasks",
  TASK_COMMENT: "Comment on tasks",
  SPRINT_CREATE: "Create sprints",
  SPRINT_START: "Start sprints",
  SPRINT_CLOSE: "Close sprints",
  AI_USE: "Use AI",
  REPORT_VIEW: "View reports",
};

const METHODOLOGY_HELP: Record<string, string> = {
  SCRUM: "Best for sprint planning, backlog grooming and regular delivery cycles.",
  KANBAN: "Best for continuous work, support, maintenance and flow-based delivery.",
  SCRUMBAN: "Best when you want Scrum planning with Kanban-style flexibility.",
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

export default function SettingsPage() {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject, clearCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [roles, setRoles] = useState<ProjectRoleWithPermissions[]>([]);
  const [memberCount, setMemberCount] = useState(0);
  const [myRoleName, setMyRoleName] = useState("Member");

  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [methodology, setMethodology] = useState("SCRUM");
  const [deleteKey, setDeleteKey] = useState("");

  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  const [savingPermission, setSavingPermission] = useState<string | null>(null);
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const isProjectOwner = project?.owner_id === currentUser?.id;

  const canManageSettings = useMemo(
    () => isProjectOwner || ["Project Admin", "Owner", "Admin"].includes(myRoleName),
    [isProjectOwner, myRoleName]
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

      setProject(freshProject);
      setCurrentProject(freshProject);
      setRoles(remoteRoles);
      setMemberCount(members.length);
      setMyRoleName(membership?.role?.name || "Member");

      setProjectName(freshProject.name);
      setDescription(freshProject.description || "");
      setMethodology(freshProject.methodology);

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

    setSavingProject(true);
    try {
      const updated = await updateProjectSettings(project.id, {
        name: projectName,
        description,
        methodology,
      });

      setProject(updated);
      setCurrentProject(updated);
      toast.success("Project settings saved");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save project settings."));
    } finally {
      setSavingProject(false);
    }
  };

  const handleTogglePermission = async (key: string) => {
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
              disabled={savingProject}
              className="h-11 bg-blue-600 px-5 hover:bg-blue-700"
            >
              {savingProject ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
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
                        <h3 className="mb-3 font-semibold text-white">{group.title}</h3>

                        <div className="grid gap-3 md:grid-cols-2">
                          {group.keys.map((key) => {
                            const enabled = selectedRoleLocked || Boolean(selectedRole.permissions?.[key]);
                            const saving = savingPermission === key;

                            return (
                              <button
                                key={key}
                                type="button"
                                disabled={selectedRoleLocked || savingPermission !== null}
                                onClick={() => handleTogglePermission(key)}
                                className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                                  enabled
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
                                  <span className={`h-3 w-3 rounded-full ${enabled ? "bg-blue-300" : "bg-slate-700"}`} />
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
