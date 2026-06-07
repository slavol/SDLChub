import { Project } from "@/services/project";

function readPersistedProjectId(): number | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem("project-storage");
    if (!raw) return null;

    const parsed = JSON.parse(raw) as {
      state?: { currentProject?: { id?: number | string | null } | null };
    };
    const id = parsed.state?.currentProject?.id;

    if (id === null || id === undefined) return null;

    const numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : null;
  } catch {
    return null;
  }
}

export function pickWorkspaceProject(
  projects: Project[],
  currentProject?: Project | null
): Project | null {
  if (projects.length === 0) return null;

  const currentId = currentProject?.id ?? readPersistedProjectId();

  if (currentId) {
    const selected = projects.find((project) => project.id === currentId);
    if (selected) return selected;
  }

  return projects[0] ?? null;
}
