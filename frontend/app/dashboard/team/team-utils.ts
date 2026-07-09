import { ProjectMember } from "@/services/project";

export function roleBadgeClass(role?: string | null) {
  if (role === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (role?.includes("Owner") || role?.includes("Manager")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (role?.includes("Lead") || role?.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export function memberDisplayName(member?: ProjectMember | null) {
  return member?.user.full_name || member?.user.email || "Unassigned";
}

export function sortMembersByDisplayName(members: ProjectMember[]) {
  return [...members].sort((left, right) =>
    memberDisplayName(left).localeCompare(memberDisplayName(right))
  );
}

function leadershipScore(member: ProjectMember, projectOwnerId: number | null) {
  const role = (member.role?.name || "").toLowerCase();

  if (projectOwnerId && member.user.id === projectOwnerId) return 100;
  if (role.includes("project admin")) return 95;
  if (role.includes("product owner") || role.includes("project manager")) return 90;
  if (role.includes("tech lead")) return 85;
  if (role.includes("scrum master") || role.includes("flow manager")) return 80;
  if (role.includes("manager") || role.includes("lead") || role.includes("owner")) return 75;

  return 0;
}

export function pickTeamManager(teamMembers: ProjectMember[], projectOwnerId: number | null) {
  // Fallback only: an explicit team manager from the database always wins in the UI.
  const candidates = sortMembersByDisplayName(teamMembers).sort(
    (left, right) => leadershipScore(right, projectOwnerId) - leadershipScore(left, projectOwnerId)
  );

  const leader = candidates[0] || null;
  return leader && leadershipScore(leader, projectOwnerId) > 0 ? leader : null;
}
