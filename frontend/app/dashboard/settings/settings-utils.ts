import { ProjectRoleWithPermissions } from "@/services/project";

export function enabledPermissions(role: ProjectRoleWithPermissions) {
  return Object.values(role.permissions || {}).filter(Boolean).length;
}

export function roleTone(roleName: string) {
  if (roleName === "Project Admin") return "border-blue-500/30 bg-blue-500/10 text-blue-300";
  if (roleName.includes("Manager") || roleName.includes("Owner")) return "border-purple-500/30 bg-purple-500/10 text-purple-300";
  if (roleName.includes("Lead") || roleName.includes("Master")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export function githubStatusTone(status?: string) {
  if (status === "CONNECTED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "ERROR") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (status === "WAITING_FOR_PING") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export function normalizeGithubWebhookUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  if (trimmed.endsWith("/github/webhook")) return trimmed;
  return `${trimmed}/github/webhook`;
}

export function githubRepoUrlFromFullName(value: string) {
  const repo = value
    .trim()
    .replace(/^https?:\/\/github\.com\//, "")
    .replace(/\.git$/, "")
    .replace(/^\/+|\/+$/g, "");
  return repo.includes("/") ? `https://github.com/${repo}` : "";
}

export function formatSettingsDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function getProjectInitials(name?: string | null, key?: string | null) {
  if (key) return key.slice(0, 2).toUpperCase();
  if (!name) return "PR";

  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PR";
}
