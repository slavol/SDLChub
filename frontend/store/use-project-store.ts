import { create } from "zustand";
import { persist } from "zustand/middleware";

import { Project } from "@/services/project";

interface ProjectState {
  currentProject: Project | null;
  hasHydrated: boolean;
  setCurrentProject: (project: Project) => void;
  clearCurrentProject: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      currentProject: null,
      hasHydrated: false,

      setCurrentProject: (project: Project) => {
        set({ currentProject: project });
      },

      clearCurrentProject: () => {
        set({ currentProject: null });
      },

      setHasHydrated: (hasHydrated: boolean) => {
        set({ hasHydrated });
      },
    }),
    {
      name: "project-storage",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
