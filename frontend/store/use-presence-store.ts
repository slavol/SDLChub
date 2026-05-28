import { create } from "zustand";

interface PresenceState {
  onlineByProject: Record<number, number[]>;
  setProjectPresence: (projectId: number, userIds: number[]) => void;
  clearPresence: () => void;
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  onlineByProject: {},

  setProjectPresence: (projectId: number, userIds: number[]) => {
    const uniqueUserIds = Array.from(new Set(userIds)).sort((a, b) => a - b);

    set((state) => ({
      onlineByProject: {
        ...state.onlineByProject,
        [projectId]: uniqueUserIds,
      },
    }));
  },

  clearPresence: () => {
    set({ onlineByProject: {} });
  },
}));
