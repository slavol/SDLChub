"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  AtSign,
  BellRing,
  BrainCircuit,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Crown,
  CalendarClock,
  Clock3,
  Inbox,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Save,
  UserRound,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { AccountSecurityPanel } from "@/components/dashboard/account-security-panel";
import { UserAvatar, resolveMediaUrl } from "@/components/user-avatar";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getPendingInvitations,
  joinProject,
  PendingInvitation,
} from "@/services/project";
import {
  AccountSummary,
  getAccountSummary,
  updateNotificationPreferences,
  updateCurrentUser,
  updateCurrentUserPassword,
  uploadCurrentUserAvatar,
} from "@/services/auth";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function roleTone(roleName: string) {
  if (roleName === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (roleName.includes("Manager") || roleName.includes("Owner")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (roleName.includes("Lead") || roleName.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

type NotificationPreferences = {
  notification_in_app_enabled: boolean;
  notification_email_enabled: boolean;
  notify_task_assignments: boolean;
  notify_mentions: boolean;
  notify_calendar: boolean;
  notify_due_dates: boolean;
  notify_ai_risk: boolean;
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  notification_in_app_enabled: true,
  notification_email_enabled: true,
  notify_task_assignments: true,
  notify_mentions: true,
  notify_calendar: true,
  notify_due_dates: true,
  notify_ai_risk: true,
};

function preferencesFromUser(user?: AccountSummary["user"] | null): NotificationPreferences {
  return {
    notification_in_app_enabled: user?.notification_in_app_enabled ?? true,
    notification_email_enabled: user?.notification_email_enabled ?? true,
    notify_task_assignments: user?.notify_task_assignments ?? true,
    notify_mentions: user?.notify_mentions ?? true,
    notify_calendar: user?.notify_calendar ?? true,
    notify_due_dates: user?.notify_due_dates ?? true,
    notify_ai_risk: user?.notify_ai_risk ?? true,
  };
}

function AccountPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex min-w-0 items-center gap-5">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-10 w-80 max-w-full" />
              <Skeleton className="h-5 w-[28rem] max-w-full" />
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
              <Skeleton className="mb-3 h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-8 w-16" />
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)]">
        {Array.from({ length: 2 }).map((_, index) => (
          <Card key={index} className="border-slate-800 bg-slate-900/80 text-slate-50">
            <CardHeader className="border-b border-slate-800/80">
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-10 w-36 rounded-xl" />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 xl:col-span-7">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-2xl" />
            ))}
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 xl:col-span-5">
          <CardHeader className="border-b border-slate-800/80">
            <Skeleton className="h-6 w-36" />
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-2xl" />
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [joiningProject, setJoiningProject] = useState(false);
  const [acceptingInvitationId, setAcceptingInvitationId] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  });
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const displayName = fullName || user?.full_name || "User";
  const avatarSrc = resolveMediaUrl(avatarUrl);
  const projects = useMemo(() => summary?.projects || [], [summary?.projects]);
  const ownedProjects = useMemo(
    () => projects.filter((project) => project.is_owner).length,
    [projects]
  );

  const loadAccount = async () => {
    setLoading(true);
    try {
      const [data, invitations] = await Promise.all([
        getAccountSummary(),
        getPendingInvitations().catch(() => [] as PendingInvitation[]),
      ]);
      setSummary(data);
      setPendingInvitations(invitations);
      setFullName(data.user.full_name || "");
      setEmail(data.user.email);
      setAvatarUrl(data.user.avatar_url || "");
      setNotificationPreferences(preferencesFromUser(data.user));
      setUser(data.user);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load account settings."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleJoinProject = async (code?: string, invitationId?: number) => {
    const nextCode = (code || invitationCode).trim().toUpperCase();

    if (!nextCode) {
      toast.error("Enter a valid invitation code.");
      return;
    }

    if (invitationId) {
      setAcceptingInvitationId(invitationId);
    } else {
      setJoiningProject(true);
    }

    try {
      const response = await joinProject(nextCode);

      if (response.project) {
        setCurrentProject(response.project);
      }

      setInvitationCode("");
      setPendingInvitations((current) =>
        current.filter((invitation) => invitation.id !== invitationId && invitation.code !== nextCode)
      );

      const data = await getAccountSummary();
      setSummary(data);
      setFullName(data.user.full_name || "");
      setEmail(data.user.email);
      setAvatarUrl(data.user.avatar_url || "");
      setNotificationPreferences(preferencesFromUser(data.user));
      setUser(data.user);

      toast.success(response.message || "Project joined.");
      router.push("/dashboard");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not join this project."));
    } finally {
      setJoiningProject(false);
      setAcceptingInvitationId(null);
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    try {
      const updated = await updateCurrentUser({
        full_name: fullName,
        email,
      });

      setUser(updated);
      setSummary((current) => (current ? { ...current, user: updated } : current));
      toast.success("Account profile updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const updated = await uploadCurrentUserAvatar(file);
      setUser(updated);
      setSummary((current) => (current ? { ...current, user: updated } : current));
      setAvatarUrl(updated.avatar_url || "");
      toast.success("Avatar uploaded");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not upload avatar."));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("New password must have at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Password confirmation does not match.");
      return;
    }

    setSavingPassword(true);
    try {
      await updateCurrentUserPassword({
        current_password: currentPassword,
        new_password: newPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update password."));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSavingNotifications(true);
    try {
      const updated = await updateNotificationPreferences(notificationPreferences);
      setUser(updated);
      setSummary((current) => (current ? { ...current, user: updated } : current));
      setNotificationPreferences(preferencesFromUser(updated));
      toast.success("Notification preferences saved");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not update notification preferences."));
    } finally {
      setSavingNotifications(false);
    }
  };

  const setNotificationPreference = (key: keyof NotificationPreferences, value: boolean) => {
    setNotificationPreferences((current) => ({ ...current, [key]: value }));
  };

  const notificationRows = [
    {
      key: "notify_task_assignments" as const,
      title: "Task assignments",
      description: "New assignments and ownership changes.",
      icon: Inbox,
    },
    {
      key: "notify_mentions" as const,
      title: "Mentions",
      description: "Comments where someone mentions you.",
      icon: AtSign,
    },
    {
      key: "notify_calendar" as const,
      title: "Calendar",
      description: "Invites and meeting reminders.",
      icon: CalendarClock,
    },
    {
      key: "notify_due_dates" as const,
      title: "Due dates",
      description: "Overdue and due soon task alerts.",
      icon: Clock3,
    },
    {
      key: "notify_ai_risk" as const,
      title: "AI risk radar",
      description: "Workload and delivery risk signals.",
      icon: BrainCircuit,
    },
  ];

  if (loading) {
    return <AccountPageSkeleton />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <UserAvatar
                name={displayName}
                email={email}
                src={avatarSrc}
                className="h-20 w-20"
                fallbackClassName="bg-blue-500/10 text-xl font-bold text-blue-200"
              />

              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <Badge className="bg-blue-600 text-white">Account</Badge>
                  <Badge variant="outline" className="border-slate-700 bg-slate-950/70 text-slate-300">
                    {summary?.projects_count || 0} projects
                  </Badge>
                  {ownedProjects > 0 && (
                    <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                      {ownedProjects} owned
                    </Badge>
                  )}
                </div>
                <h1 className="truncate text-3xl font-semibold tracking-tight text-white md:text-4xl">
                  {displayName}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  Manage your identity, security and project memberships.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <BriefcaseBusiness className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Project memberships</p>
            <p className="mt-1 text-2xl font-semibold text-white">{summary?.projects_count || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <Crown className="mb-3 h-5 w-5 text-amber-300" />
            <p className="text-sm text-slate-500">Owned projects</p>
            <p className="mt-1 text-2xl font-semibold text-white">{ownedProjects}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-sm text-slate-500">Account status</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {summary?.user.is_active ? "Active" : "Inactive"}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-12">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-7">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-blue-400" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 border-slate-700 bg-slate-950"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 border-slate-700 bg-slate-950 pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Avatar</Label>
                <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 sm:flex-row sm:items-center">
                  <UserAvatar
                    name={displayName}
                    email={email}
                    src={avatarSrc}
                    className="h-16 w-16"
                    fallbackClassName="bg-blue-500/10 text-lg font-bold text-blue-200"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">Upload a profile photo</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      JPG, PNG, WEBP or GIF. Maximum size 2MB.
                    </p>
                  </div>

                  <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700">
                    {uploadingAvatar ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Upload
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="sr-only"
                      disabled={uploadingAvatar}
                      onChange={(event) => {
                        handleAvatarUpload(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>

              <Button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save profile
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-5">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <BriefcaseBusiness className="h-5 w-5 text-emerald-300" />
                My projects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge className="bg-blue-500/10 text-blue-300 hover:bg-blue-500/10">
                        {project.key}
                      </Badge>
                      <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                        {project.methodology}
                      </Badge>
                      {project.is_owner && (
                        <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-300">
                          Owner
                        </Badge>
                      )}
                    </div>
                    <p className="truncate font-semibold text-white">{project.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Joined {formatDate(project.joined_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className={roleTone(project.role_name)}>
                    {project.role_name}
                  </Badge>
                </div>
              ))}

              {projects.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-sm text-slate-500">
                  You are not part of any project yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-12">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-cyan-300" />
                Project access
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold text-white">Pending invitations</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Accept invitations sent to your account email and append another workspace to this profile.
                  </p>
                </div>

                {pendingInvitations.length > 0 ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {pendingInvitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/75 p-4 lg:flex-row lg:items-center lg:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge className="bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/10">
                              {invitation.project_name}
                            </Badge>
                            <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                              {invitation.role_name}
                            </Badge>
                          </div>
                          <p className="truncate text-sm font-semibold text-white">
                            Invitation for {invitation.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Sent {formatDate(invitation.created_at)}
                          </p>
                        </div>

                        <Button
                          onClick={() => handleJoinProject(invitation.code, invitation.id)}
                          disabled={acceptingInvitationId === invitation.id || joiningProject}
                          className="w-full bg-cyan-600 hover:bg-cyan-700 lg:w-auto"
                        >
                          {acceptingInvitationId === invitation.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowRight className="mr-2 h-4 w-4" />
                          )}
                          Accept
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/55 p-5 text-sm leading-6 text-slate-500">
                    No pending invitations for this email. If a Project Admin invited you,
                    the invitation will appear here after it is sent.
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-blue-300">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Join with code</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Use a one-time project code received from a Project Admin.
                    </p>
                  </div>
                </div>

                <Label htmlFor="account-invitation-code">Invitation code</Label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <Input
                    id="account-invitation-code"
                    value={invitationCode}
                    onChange={(event) => setInvitationCode(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleJoinProject();
                      }
                    }}
                    placeholder="GFW-AB12CD34"
                    className="h-11 border-slate-700 bg-slate-950 font-mono uppercase tracking-wide"
                  />
                  <Button
                    onClick={() => handleJoinProject()}
                    disabled={joiningProject || !invitationCode.trim()}
                    className="h-11 shrink-0 bg-blue-600 hover:bg-blue-700"
                  >
                    {joiningProject ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    Join
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-5">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-amber-300" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Current password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className="h-11 border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>New password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-11 border-slate-700 bg-slate-950"
                />
              </div>
              <div className="space-y-2">
                <Label>Confirm new password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-11 border-slate-700 bg-slate-950"
                />
              </div>

              <Button
                onClick={handleChangePassword}
                disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
                className="w-full bg-amber-600 hover:bg-amber-700"
              >
                {savingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                Change password
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-7">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-blue-300" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">In-app channel</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Bell, sidebar count and live toasts.</p>
                    </div>
                    <Switch
                      checked={notificationPreferences.notification_in_app_enabled}
                      onCheckedChange={(value) =>
                        setNotificationPreference("notification_in_app_enabled", value)
                      }
                      className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-700"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Email channel</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Transactional emails sent through SMTP.</p>
                    </div>
                    <Switch
                      checked={notificationPreferences.notification_email_enabled}
                      onCheckedChange={(value) =>
                        setNotificationPreference("notification_email_enabled", value)
                      }
                      className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-700"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {notificationRows.map((row) => {
                  const Icon = row.icon;
                  return (
                    <div
                      key={row.key}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-950/65 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white">{row.title}</p>
                          <p className="mt-0.5 text-xs leading-5 text-slate-500">{row.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={notificationPreferences[row.key]}
                        onCheckedChange={(value) => setNotificationPreference(row.key, value)}
                        className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-700"
                      />
                    </div>
                  );
                })}
              </div>

              <Button
                onClick={handleSaveNotifications}
                disabled={savingNotifications}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {savingNotifications ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save notifications
              </Button>
            </CardContent>
          </Card>

          <div className="xl:col-span-12">
            <AccountSecurityPanel />
          </div>
      </section>
    </div>
  );
}
