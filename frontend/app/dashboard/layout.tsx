"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { getMyProjects } from "@/services/project";
import { Loader2 } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [methodology, setMethodology] = useState<string>("SCRUM"); // Default fallback
  const [projectName, setProjectName] = useState<string>("");
  const [role, setRole] = useState<string>("Owner"); // In future fetch from API
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProjectContext = async () => {
      try {
        const projects = await getMyProjects();
        if (projects.length > 0) {
          // For MVP we take the first project. In future, we use a ProjectSelector
          setMethodology(projects[0].methodology);
          setProjectName(projects[0].name);
        }
      } catch (error) {
        console.error("Failed to load project context", error);
      } finally {
        setLoading(false);
      }
    };
    loadProjectContext();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-blue-500">
        <Loader2 className="w-10 h-10 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar is now persistent across all dashboard pages */}
      <AppSidebar methodology={methodology} role={role} projectName={projectName} />
      
      {/* Main content area (scrollable) */}
      <main className="flex-1 overflow-y-auto bg-slate-950">
        {children}
      </main>
    </div>
  );
}