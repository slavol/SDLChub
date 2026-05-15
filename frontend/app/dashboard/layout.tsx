"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { getMyProjects, getProjectMembers } from "@/services/project";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [methodology, setMethodology] = useState<string>("SCRUM");
  const [projectName, setProjectName] = useState<string>("");
  const [role, setRole] = useState<string>("Member");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjectContext = async () => {
      try {
        let project = currentProject;

        if (!project) {
          const projects = await getMyProjects();
          project = projects[0] ?? null;

          if (project) {
            setCurrentProject(project);
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
      <AppSidebar methodology={methodology} role={role} projectName={projectName} />

      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}
