import {
  CalendarAvailability,
  CalendarAvailabilityStatus,
  CalendarEvent,
  CalendarEventType,
} from "@/services/calendar";
import { ProjectMember } from "@/services/project";
import { Sprint } from "@/services/sprint";
import { Task } from "@/services/task";

export type CalendarView = "month" | "week" | "day" | "agenda";
export type RecurrenceMode = "none" | "daily" | "weekdays" | "weekly";
export type CalendarFeedItem =
  | {
      id: string;
      kind: "task";
      date: Date;
      title: string;
      task: Task;
      assigneeName: string;
    }
  | {
      id: string;
      kind: "event";
      date: Date;
      title: string;
      event: CalendarEvent;
    }
  | {
      id: string;
      kind: "availability";
      date: Date;
      title: string;
      availability: CalendarAvailability;
      userName: string;
    }
  | {
      id: string;
      kind: "sprint";
      date: Date;
      title: string;
      sprint: Sprint;
      milestone: "START" | "END";
    };

export const eventTypes: { value: CalendarEventType; label: string }[] = [
  { value: "MEETING", label: "Meeting" },
  { value: "DAILY", label: "Daily" },
  { value: "PLANNING", label: "Planning" },
  { value: "REVIEW", label: "Review" },
  { value: "RETRO", label: "Retro" },
  { value: "FOCUS", label: "Focus" },
  { value: "OTHER", label: "Other" },
];

export const recurrenceOptions: { value: RecurrenceMode; label: string; description: string }[] = [
  { value: "none", label: "Does not repeat", description: "Create a single event." },
  { value: "daily", label: "Daily", description: "Repeat every day until the selected date." },
  { value: "weekdays", label: "Weekdays", description: "Repeat Monday through Friday." },
  { value: "weekly", label: "Weekly", description: "Repeat on the same weekday." },
];

export const availabilityStatusOptions: { value: CalendarAvailabilityStatus; label: string; description: string }[] = [
  { value: "VACATION", label: "Vacation", description: "Time off / concediu planificat." },
  { value: "SICK_LEAVE", label: "Sick leave", description: "Medical leave or health-related absence." },
  { value: "UNAVAILABLE", label: "Unavailable", description: "The member is blocked for work/meetings." },
  { value: "FOCUS_TIME", label: "Focus time", description: "Protected deep-work interval." },
  { value: "AVAILABLE", label: "Available", description: "Explicit availability window." },
];

export const eventTypeClass: Record<string, string> = {
  MEETING: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  DAILY: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  PLANNING: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  REVIEW: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  RETRO: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  FOCUS: "border-slate-600 bg-slate-800 text-slate-300",
  OTHER: "border-slate-600 bg-slate-800 text-slate-300",
};

export const availabilityStatusClass: Record<string, string> = {
  AVAILABLE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  UNAVAILABLE: "border-rose-500/25 bg-rose-500/10 text-rose-300",
  VACATION: "border-sky-500/25 bg-sky-500/10 text-sky-300",
  SICK_LEAVE: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  FOCUS_TIME: "border-violet-500/25 bg-violet-500/10 text-violet-300",
};

export function availabilityLabel(status: string) {
  return availabilityStatusOptions.find((option) => option.value === status)?.label || status.replaceAll("_", " ");
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonth(date: Date) {
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function toInputDate(date: Date) {
  return dateKey(date);
}

export function toInputTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function combineDateAndTime(date: Date, time: string) {
  return `${toInputDate(date)}T${time}:00`;
}

export function formatDateTime(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getInitials(name?: string | null) {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((part) => part[0]?.toUpperCase()).join("") : "U";
}

export function getCalendarDays(cursor: Date) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  // Month grid is always six rows so the layout does not jump between months.
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function getWeekDays(anchor: Date) {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function memberName(member?: ProjectMember) {
  return member?.user.full_name || member?.user.email || "Unassigned";
}

export function attendeeNames(event: CalendarEvent, memberMap: Map<number, ProjectMember>) {
  return event.attendee_ids
    .map((id) => memberName(memberMap.get(id)))
    .filter(Boolean);
}

export function feedItemTone(item: CalendarFeedItem) {
  if (item.kind === "task") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }

  if (item.kind === "sprint") {
    return item.milestone === "START"
      ? "border border-indigo-500/20 bg-indigo-500/10 text-indigo-200"
      : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }

  if (item.kind === "availability") {
    return availabilityStatusClass[item.availability.status] || availabilityStatusClass.UNAVAILABLE;
  }

  return eventTypeClass[item.event.event_type] || eventTypeClass.OTHER;
}

export function feedItemLabel(item: CalendarFeedItem) {
  if (item.kind === "task") return item.task.key;
  if (item.kind === "sprint") return `SPRINT ${item.milestone}`;
  if (item.kind === "availability") return availabilityLabel(item.availability.status);
  return item.event.event_type;
}
