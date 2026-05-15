import api from "@/lib/axios";

export type CalendarEventType =
  | "MEETING"
  | "DAILY"
  | "PLANNING"
  | "REVIEW"
  | "RETRO"
  | "FOCUS"
  | "OTHER";

export interface CalendarEvent {
  id: number;
  project_id: number;
  title: string;
  description?: string | null;
  event_type: CalendarEventType | string;
  starts_at: string;
  ends_at: string;
  location?: string | null;
  meeting_url?: string | null;
  attendee_ids: number[];
  created_by_id: number;
  created_by_name?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface CalendarEventCreate {
  title: string;
  description?: string | null;
  event_type: CalendarEventType | string;
  starts_at: string;
  ends_at: string;
  location?: string | null;
  meeting_url?: string | null;
  attendee_ids: number[];
}

export const getProjectCalendarEvents = async (
  projectId: number,
  params: { start?: string; end?: string } = {}
): Promise<CalendarEvent[]> => {
  const response = await api.get(`/calendar/project/${projectId}`, { params });
  return response.data;
};

export const createProjectCalendarEvent = async (
  projectId: number,
  data: CalendarEventCreate
): Promise<CalendarEvent> => {
  const response = await api.post(`/calendar/project/${projectId}`, data);
  return response.data;
};

export const deleteCalendarEvent = async (
  eventId: number
): Promise<{ message: string }> => {
  const response = await api.delete(`/calendar/${eventId}`);
  return response.data;
};
