"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import {
  dispatchRealtimeMessage,
  REALTIME_OUTGOING_EVENT_NAME,
  OutgoingRealtimeMessage,
  RealtimeMessage,
} from "@/hooks/use-realtime-event";
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
              notification_in_app_enabled:
                typeof payload.notification_in_app_enabled === "boolean"
                  ? payload.notification_in_app_enabled
                  : currentUser.notification_in_app_enabled,
              notification_email_enabled:
                typeof payload.notification_email_enabled === "boolean"
                  ? payload.notification_email_enabled
                  : currentUser.notification_email_enabled,
              notify_task_assignments:
                typeof payload.notify_task_assignments === "boolean"
                  ? payload.notify_task_assignments
                  : currentUser.notify_task_assignments,
              notify_mentions:
                typeof payload.notify_mentions === "boolean"
                  ? payload.notify_mentions
                  : currentUser.notify_mentions,
              notify_calendar:
                typeof payload.notify_calendar === "boolean"
                  ? payload.notify_calendar
                  : currentUser.notify_calendar,
              notify_due_dates:
                typeof payload.notify_due_dates === "boolean"
                  ? payload.notify_due_dates
                  : currentUser.notify_due_dates,
              notify_ai_risk:
                typeof payload.notify_ai_risk === "boolean"
                  ? payload.notify_ai_risk
                  : currentUser.notify_ai_risk,
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

    const outboundListener = (event: Event) => {
      const customEvent = event as CustomEvent<OutgoingRealtimeMessage>;
      const message = customEvent.detail;

      if (!message?.type) return;

      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      socket.send(JSON.stringify(message));
    };

    window.addEventListener(REALTIME_OUTGOING_EVENT_NAME, outboundListener);
    connect();

    return () => {
      window.removeEventListener(REALTIME_OUTGOING_EVENT_NAME, outboundListener);

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
