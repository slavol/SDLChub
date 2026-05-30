import api from "@/lib/axios";

export interface NotificationItem {
  id: number;
  user_id: number;
  project_id?: number | null;
  task_id?: number | null;
  type: string;
  title: string;
  message?: string | null;
  link_url?: string | null;
  metadata_json?: string | null;
  read_at?: string | null;
  created_at: string;
}

export const getNotifications = async (
  unreadOnly = false,
  limit = 80
): Promise<NotificationItem[]> => {
  const response = await api.get("/notifications", {
    params: {
      unread_only: unreadOnly,
      limit,
    },
  });

  return response.data;
};

export const getUnreadNotificationCount = async (): Promise<number> => {
  const response = await api.get("/notifications/unread-count");
  return response.data.count;
};

export const markNotificationRead = async (
  notificationId: number
): Promise<NotificationItem> => {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
};

export const markAllNotificationsRead = async (): Promise<{ updated: number }> => {
  const response = await api.put("/notifications/read-all");
  return response.data;
};

export const generateDueTaskReminders = async (
  projectId?: number | null
): Promise<{
  created: number;
  due_task_created?: number;
  calendar_created?: number;
  calendar_lookahead_minutes?: number;
}> => {
  const response = await api.post("/notifications/generate-reminders", null, {
    params: projectId
      ? {
          project_id: projectId,
          include_calendar: true,
          calendar_lookahead_minutes: 60,
        }
      : {
          include_calendar: true,
          calendar_lookahead_minutes: 60,
        },
  });

  return response.data;
};
