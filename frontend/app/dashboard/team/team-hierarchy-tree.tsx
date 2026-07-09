"use client";

import { Network, Trash2, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { ProjectMember, ProjectTeam } from "@/services/project";

import { memberDisplayName, pickTeamManager, roleBadgeClass } from "./team-utils";

type TeamPersonCardProps = {
  member: ProjectMember | null;
  label: string;
  onlineUserIdSet: Set<number>;
  compact?: boolean;
  muted?: boolean;
};

export function TeamPersonCard({
  member,
  label,
  onlineUserIdSet,
  compact,
  muted,
}: TeamPersonCardProps) {
  const roleName = member?.role?.name || "No role assigned";
  const isOnline = Boolean(member && onlineUserIdSet.has(member.user.id));

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-3 transition",
        compact ? "bg-slate-900/70" : "bg-slate-950/85",
        muted
          ? "border-dashed border-slate-800 text-slate-500"
          : "border-slate-800 hover:border-blue-500/30"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {member ? (
          <UserAvatar
            name={member.user.full_name}
            email={member.user.email}
            src={member.user.avatar_url}
            className={cn(
              "shrink-0 border border-slate-700",
              compact ? "h-9 w-9" : "h-12 w-12"
            )}
            fallbackClassName={compact ? "text-xs" : "text-sm"}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-slate-700 bg-slate-900 text-slate-500">
            <Users className="h-5 w-5" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-white">
              {member ? memberDisplayName(member) : "No manager assigned"}
            </p>
            {isOnline && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
            )}
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "max-w-full truncate",
                member ? roleBadgeClass(roleName) : "border-slate-800 bg-slate-900 text-slate-500"
              )}
            >
              {label}
            </Badge>
            {member && !compact && (
              <span className="truncate text-xs text-slate-500">
                {roleName}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type TeamHierarchyTreeProps = {
  rootTeams: ProjectTeam[];
  allTeamsCount: number;
  childTeamsByParent: Record<number, ProjectTeam[]>;
  membersByTeam: Record<number, ProjectMember[]>;
  members: ProjectMember[];
  managerOptions: ProjectMember[];
  myTeamId?: number | null;
  projectOwnerId: number | null;
  canManageTeams: boolean;
  onlineUserIdSet: Set<number>;
  onDeleteTeam: (team: ProjectTeam) => void;
  onChangeTeamManager: (team: ProjectTeam, managerMembershipId: string) => void;
};

export function TeamHierarchyTree({
  rootTeams,
  allTeamsCount,
  childTeamsByParent,
  membersByTeam,
  members,
  managerOptions,
  myTeamId,
  projectOwnerId,
  canManageTeams,
  onlineUserIdSet,
  onDeleteTeam,
  onChangeTeamManager,
}: TeamHierarchyTreeProps) {
  const renderTeamTreeNode = (team: ProjectTeam, depth = 0) => {
    const children = childTeamsByParent[team.id] || [];
    const teamMembers = membersByTeam[team.id] || [];
    const explicitManager = team.manager_membership_id
      ? members.find((member) => member.membership_id === team.manager_membership_id) || null
      : null;
    // Explicit managers come from the database. Suggested managers are only a UX fallback
    // for older teams that do not yet have a manager saved.
    const inferredManager = explicitManager ? null : pickTeamManager(teamMembers, projectOwnerId);
    const manager = explicitManager || inferredManager;
    const managerLabel = explicitManager
      ? "Manager"
      : manager
        ? "Suggested manager"
        : "Manager slot";
    const directReports = manager
      ? teamMembers.filter((member) => member.membership_id !== manager.membership_id)
      : teamMembers;
    const isMyTeam = myTeamId === team.id;

    return (
      <div key={team.id} className="relative">
        {depth > 0 && (
          <div className="mx-auto mb-3 hidden h-5 w-px bg-slate-800 md:block" />
        )}

        <div
          className={cn(
            "rounded-[1.35rem] border bg-slate-950/70 p-4 shadow-xl shadow-black/10 transition",
            isMyTeam
              ? "border-cyan-400/45 bg-cyan-500/10"
              : "border-slate-800 hover:border-slate-700"
          )}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
                  <Network className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold text-white">{team.name}</h3>
                    {isMyTeam && (
                      <Badge className="bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/10">
                        My team
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                    {team.description || "Delivery group with assigned ownership and work visibility."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                {teamMembers.length || team.member_count} members
              </Badge>
              <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                {team.task_count} tasks
              </Badge>
              {children.length > 0 && (
                <Badge variant="outline" className="border-slate-700 bg-slate-900 text-slate-300">
                  {children.length} subteams
                </Badge>
              )}
              {canManageTeams && (
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0 text-slate-500 hover:bg-red-950/30 hover:text-red-400"
                  onClick={() => onDeleteTeam(team)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(18rem,0.78fr)_minmax(0,1.22fr)]">
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Manager
                </p>
                {inferredManager && (
                  <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-200">
                    Suggested
                  </Badge>
                )}
              </div>
              <TeamPersonCard
                member={manager}
                label={managerLabel}
                muted={!manager}
                onlineUserIdSet={onlineUserIdSet}
              />

              {canManageTeams && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs uppercase tracking-[0.16em] text-slate-600">
                    Set manager
                  </Label>
                  <Select
                    value={
                      team.manager_membership_id
                        ? String(team.manager_membership_id)
                        : "none"
                    }
                    onValueChange={(value) => onChangeTeamManager(team, value)}
                  >
                    <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                      <SelectValue placeholder="No explicit manager" />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-900 text-slate-200">
                      <SelectItem value="none">No explicit manager</SelectItem>
                      {managerOptions.map((member) => (
                        <SelectItem
                          key={member.membership_id}
                          value={String(member.membership_id)}
                        >
                          {memberDisplayName(member)} · {member.role?.name || "Member"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                  Direct reports
                </p>
                <span className="text-xs text-slate-600">{directReports.length}</span>
              </div>

              {directReports.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {directReports.slice(0, 8).map((member) => (
                    <TeamPersonCard
                      key={member.membership_id}
                      member={member}
                      label={member.role?.name || "Member"}
                      compact
                      onlineUserIdSet={onlineUserIdSet}
                    />
                  ))}
                  {directReports.length > 8 && (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-500">
                      +{directReports.length - 8} more
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-500">
                  No direct reports assigned to this team yet.
                </div>
              )}
            </div>
          </div>
        </div>

        {children.length > 0 && (
          <div className="relative mt-4">
            <div className="mx-auto hidden h-5 w-px bg-slate-800 md:block" />
            <div className="grid gap-4 xl:grid-cols-2">
              {children.map((child) => renderTeamTreeNode(child, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (allTeamsCount === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
        <Network className="mx-auto mb-3 h-8 w-8 text-slate-600" />
        <p className="text-sm text-slate-500">No teams created yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rootTeams.map((team) => renderTeamTreeNode(team))}
    </div>
  );
}
