import { Project, ProjectMember } from "@/services/project";
import { User } from "@/store/use-auth-store";

export function hasProjectPermission(
  project: Project | null | undefined,
  user: User | null | undefined,
  membership: ProjectMember | null | undefined,
  permissionKey: string
) {
  if (!project || !user) return false;
  if (project.owner_id === user.id) return true;

  const roleName = membership?.role?.name;
  if (roleName === "Project Admin") return true;

  return Boolean(membership?.role?.permissions?.[permissionKey]);
}
