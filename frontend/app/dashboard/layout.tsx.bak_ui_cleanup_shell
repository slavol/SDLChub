"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Archive, Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { RealtimeBridge } from "@/components/realtime/realtime-bridge";
import { getMyProjects, getProjectMembers } from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [methodology, setMethodology] = useState<string>("SCRUM");
  const [projectName, setProjectName] = useState<string>("");
  const [role, setRole] = useState<string>("Member");
  const [loading, setLoading] = useState(true);
  const isArchived = Boolean(currentProject?.is_archived);
  const archivedReadOnly = isArchived && pathname !== "/dashboard/support";

  useEffect(() => {
    const loadProjectContext = async () => {
      try {
        let project = currentProject;
        const projects = await getMyProjects();

        if (!project) {
          project = projects[0] ?? null;

          if (project) {
            setCurrentProject(project);
          }
        } else {
          const freshProject = projects.find((item) => item.id === project?.id);
          if (
            freshProject &&
            (freshProject.is_archived !== project.is_archived ||
              freshProject.methodology !== project.methodology ||
              freshProject.name !== project.name)
          ) {
            project = freshProject;
            setCurrentProject(freshProject);
          }
        }

        if (!project) {
          router.replace("/onboarding");
          return;
        }

        setMethodology(project.methodology);
        setProjectName(project.name);

        if (currentUser?.id) {
          if (project.owner_id === currentUser.id) {
            setRole("Owner");
          } else {
            try {
              const members = await getProjectMembers(project.id);
              const membership = members.find((member) => member.user.id === currentUser.id);
              setRole(membership?.role?.name || "Member");
            } catch {
              setRole("Member");
            }
          }
        }
      } catch (error) {
        console.error("Failed to load project context", error);
      } finally {
        setLoading(false);
      }
    };

    loadProjectContext();
  }, [currentProject, currentUser?.id, router, setCurrentProject]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <RealtimeBridge />
      <AppSidebar methodology={methodology} role={role} projectName={projectName} />

      <main className="flex-1 overflow-y-auto bg-slate-950">
        {isArchived && (
          <div className="sticky top-0 z-40 border-b border-amber-500/25 bg-amber-950/80 px-6 py-3 text-amber-50 shadow-xl shadow-slate-950/25 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-500/15">
                <Archive className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Project archived
                </p>
                <p className="text-xs text-amber-100/75">
                  This workspace is available for review only. Editing, creation
                  and workflow actions are disabled until a Global Admin restores it.
                </p>
              </div>
              <AlertTriangle className="ml-auto h-4 w-4 text-amber-200" />
            </div>
          </div>
        )}
        <div className={archivedReadOnly ? "pointer-events-none opacity-60" : ""}>
          {children}
        </div>
      </main>
    </div>
  );
}
