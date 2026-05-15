import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Project } from "@/services/project";

interface ProjectState {
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,

      setCurrentProject: (project: Project) => {
        set({ currentProject: project });
      },

      clearCurrentProject: () => {
        set({ currentProject: null });
      },
    }),
    {
      name: "project-storage",
    }
  )
);
