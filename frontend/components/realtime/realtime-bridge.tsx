"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { dispatchRealtimeMessage, RealtimeMessage } from "@/hooks/use-realtime-event";
import { useAuthStore } from "@/store/use-auth-store";
import { usePresenceStore } from "@/store/use-presence-store";
import { useProjectStore } from "@/store/use-project-store";

function getRealtimeUrl(token: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  const url = new URL(apiUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws";
  url.search = `token=${encodeURIComponent(token)}`;

  return url.toString();
}

export function RealtimeBridge() {
  const token = useAuthStore((state) => state.token);
  const reconnectTimerRef = useRef<number | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const manuallyClosedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    manuallyClosedRef.current = false;

    const connect = () => {
      const socket = new WebSocket(getRealtimeUrl(token));
      socketRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as RealtimeMessage;
          dispatchRealtimeMessage(message);

          if (message.type === "notification.created") {
            const title = String(message.payload?.title || "New notification");
            toast.info(title);
          }

          const payload = message.payload;

          const currentUser = useAuthStore.getState().user;

          if (message.type === "presence.changed" && message.project_id && payload) {
            const onlineUserIds = Array.isArray(payload.online_user_ids)
              ? payload.online_user_ids
                  .map((value) => Number(value))
                  .filter((value) => Number.isFinite(value))
              : [];

            usePresenceStore.getState().setProjectPresence(message.project_id, onlineUserIds);
          }

          if (message.type === "user.updated" && payload && payload.user_id === currentUser?.id && currentUser) {
            useAuthStore.getState().setUser({
              ...currentUser,
              full_name: String(payload.full_name || currentUser.full_name || ""),
              email: String(payload.email || currentUser.email),
              avatar_url:
                typeof payload.avatar_url === "string"
                  ? payload.avatar_url
                : currentUser.avatar_url,
            });
          }

          if (message.type === "project.changed" && payload?.project) {
            const currentProject = useProjectStore.getState().currentProject;
            const nextProject = payload.project as {
              id?: number;
              name?: string;
              key?: string;
              description?: string | null;
              methodology?: string;
              owner_id?: number;
              created_at?: string;
              logo_url?: string | null;
              is_archived?: boolean;
              workflow_config?: { wip_limits?: Record<string, number | null> } | null;
            };

            if (currentProject && currentProject.id === nextProject.id) {
              useProjectStore.getState().setCurrentProject({
                ...currentProject,
                ...nextProject,
                id: currentProject.id,
                name: nextProject.name || currentProject.name,
                key: nextProject.key || currentProject.key,
                methodology: nextProject.methodology || currentProject.methodology,
                owner_id:
                  typeof nextProject.owner_id === "number"
                    ? nextProject.owner_id
                    : currentProject.owner_id,
              });
            }
          }
        } catch {
          // Ignore malformed realtime messages.
        }
      };

      socket.onclose = () => {
        socketRef.current = null;

        if (manuallyClosedRef.current) return;

        reconnectTimerRef.current = window.setTimeout(connect, 2500);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    connect();

    return () => {
      manuallyClosedRef.current = true;

      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      socketRef.current?.close();
      socketRef.current = null;
      usePresenceStore.getState().clearPresence();
    };
  }, [token]);

  return null;
}
