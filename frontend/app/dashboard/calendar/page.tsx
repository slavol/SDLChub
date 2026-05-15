"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  LayoutGrid,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  UserRound,
  Users2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  CalendarEvent,
  CalendarEventType,
  createProjectCalendarEvent,
  deleteCalendarEvent,
  getProjectCalendarEvents,
} from "@/services/calendar";
import {
  getMyProjects,
  getProjectMembers,
  Project,
  ProjectMember,
} from "@/services/project";
import { getProjectTasks, Task, TaskPriority, TaskStatus } from "@/services/task";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";

type CalendarView = "month" | "week" | "agenda";
type CalendarFeedItem =
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
    };

const eventTypes: { value: CalendarEventType; label: string }[] = [
  { value: "MEETING", label: "Meeting" },
  { value: "DAILY", label: "Daily" },
  { value: "PLANNING", label: "Planning" },
  { value: "REVIEW", label: "Review" },
  { value: "RETRO", label: "Retro" },
  { value: "FOCUS", label: "Focus" },
  { value: "OTHER", label: "Other" },
];

const taskStatusClass: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskStatus.IN_PROGRESS]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskStatus.REVIEW]: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  [TaskStatus.DONE]: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
};

const taskPriorityClass: Record<TaskPriority, string> = {
  [TaskPriority.LOW]: "border-slate-700 bg-slate-800/70 text-slate-300",
  [TaskPriority.MEDIUM]: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  [TaskPriority.HIGH]: "border-orange-500/25 bg-orange-500/10 text-orange-300",
  [TaskPriority.CRITICAL]: "border-rose-500/25 bg-rose-500/10 text-rose-300",
};

const eventTypeClass: Record<string, string> = {
  MEETING: "border-blue-500/25 bg-blue-500/10 text-blue-300",
  DAILY: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
  PLANNING: "border-violet-500/25 bg-violet-500/10 text-violet-300",
  REVIEW: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  RETRO: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  FOCUS: "border-slate-600 bg-slate-800 text-slate-300",
  OTHER: "border-slate-600 bg-slate-800 text-slate-300",
};

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonth(date: Date) {
  return date.toLocaleDateString([], { month: "long", year: "numeric" });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateTime(date: Date) {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getInitials(name?: string | null) {
  if (!name) return "U";

  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.length ? parts.map((part) => part[0]?.toUpperCase()).join("") : "U";
}

function getCalendarDays(cursor: Date) {
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function getWeekDays(anchor: Date) {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - anchor.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function memberName(member?: ProjectMember) {
  return member?.user.full_name || member?.user.email || "Unassigned";
}

function attendeeNames(event: CalendarEvent, memberMap: Map<number, ProjectMember>) {
  return event.attendee_ids
    .map((id) => memberName(memberMap.get(id)))
    .filter(Boolean);
}

function CalendarItemCard({
  item,
  memberMap,
  onDeleteEvent,
}: {
  item: CalendarFeedItem;
  memberMap: Map<number, ProjectMember>;
  onDeleteEvent: (event: CalendarEvent) => void;
}) {
  if (item.kind === "task") {
    return (
      <Link
        href={`/dashboard/tasks/${item.task.id}`}
        className="group block rounded-2xl border border-slate-800 bg-slate-950/80 p-4 transition hover:border-blue-500/35 hover:bg-slate-950"
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-slate-700 bg-slate-900 font-mono text-[10px] text-slate-300">
            {item.task.key}
          </Badge>
          <Badge variant="outline" className={cn("border text-[10px]", taskStatusClass[item.task.status])}>
            {item.task.status.replaceAll("_", " ")}
          </Badge>
          <Badge variant="outline" className={cn("border text-[10px]", taskPriorityClass[item.task.priority])}>
            {item.task.priority}
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-200">
          {item.title}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5" />
            {item.assigneeName}
          </span>
          <span>{formatTime(item.date)}</span>
        </div>
      </Link>
    );
  }

  const names = attendeeNames(item.event, memberMap);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <Badge
          variant="outline"
          className={cn("border text-[10px]", eventTypeClass[item.event.event_type] || eventTypeClass.OTHER)}
        >
          {item.event.event_type}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-slate-500 hover:bg-red-950/30 hover:text-red-300"
          onClick={() => onDeleteEvent(item.event)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
      {item.event.description && (
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
          {item.event.description}
        </p>
      )}

      <div className="mt-3 space-y-2 text-xs text-slate-500">
        <p className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          {formatTime(item.date)} - {formatTime(new Date(item.event.ends_at))}
        </p>
        {item.event.location && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {item.event.location}
          </p>
        )}
        {item.event.meeting_url && (
          <a
            href={item.event.meeting_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-blue-300 hover:text-blue-200"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open meeting link
          </a>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex -space-x-2">
          {names.slice(0, 4).map((name) => (
            <Avatar key={name} className="h-7 w-7 border border-slate-800">
              <AvatarFallback className="bg-blue-500/10 text-[10px] text-blue-200">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {names.length ? `${names.length} attendees` : "No attendees"}
        </p>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("MEETING");
  const [eventDate, setEventDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.user.id, member])),
    [members]
  );

  const loadCalendar = useCallback(async () => {
    setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = projects[0] ?? null;

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      setProject(selectedProject);

      if (!selectedProject) {
        setMembers([]);
        setTasks([]);
        setEvents([]);
        return;
      }

      const [projectMembers, projectTasks, projectEvents] = await Promise.all([
        getProjectMembers(selectedProject.id),
        getProjectTasks(selectedProject.id, "backlog"),
        getProjectCalendarEvents(selectedProject.id),
      ]);

      setMembers(projectMembers);
      setTasks(projectTasks);
      setEvents(projectEvents);

      if (selectedAttendees.length === 0 && currentUser?.id) {
        setSelectedAttendees([currentUser.id]);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load calendar."));
    } finally {
      setLoading(false);
    }
  }, [currentProject, currentUser?.id, selectedAttendees.length, setCurrentProject]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useEffect(() => {
    if (eventDialogOpen) {
      setEventDate(selectedDate);
    }
  }, [eventDialogOpen, selectedDate]);

  const feedItems = useMemo<CalendarFeedItem[]>(() => {
    const taskItems: CalendarFeedItem[] = tasks
      .map((task) => {
        const dueDate = parseDate(task.due_date);
        if (!dueDate) return null;

        const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : undefined;
        return {
          id: `task-${task.id}`,
          kind: "task" as const,
          date: dueDate,
          title: task.title,
          task,
          assigneeName: task.assignee_name || memberName(assignee),
        };
      })
      .filter(Boolean) as CalendarFeedItem[];

    const eventItems: CalendarFeedItem[] = events
      .map((event) => {
        const startsAt = parseDate(event.starts_at);
        if (!startsAt) return null;

        return {
          id: `event-${event.id}`,
          kind: "event" as const,
          date: startsAt,
          title: event.title,
          event,
        };
      })
      .filter(Boolean) as CalendarFeedItem[];

    return [...taskItems, ...eventItems].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, memberMap, tasks]);

  const filteredItems = useMemo(() => {
    const selectedMemberId = memberFilter === "all" ? null : Number(memberFilter);
    const currentUserId = currentUser?.id;

    return feedItems.filter((item) => {
      if (typeFilter === "tasks" && item.kind !== "task") return false;
      if (typeFilter === "events" && item.kind !== "event") return false;
      if (
        !["all", "tasks", "events"].includes(typeFilter) &&
        (item.kind !== "event" || item.event.event_type !== typeFilter)
      ) {
        return false;
      }

      if (selectedMemberId) {
        if (item.kind === "task") return item.task.assignee_id === selectedMemberId;
        return item.event.attendee_ids.includes(selectedMemberId) || item.event.created_by_id === selectedMemberId;
      }

      if (onlyMine && currentUserId) {
        if (item.kind === "task") return item.task.assignee_id === currentUserId;
        return item.event.attendee_ids.includes(currentUserId) || item.event.created_by_id === currentUserId;
      }

      return true;
    });
  }, [currentUser?.id, feedItems, memberFilter, onlyMine, typeFilter]);

  const selectedDayItems = filteredItems.filter((item) => dateKey(item.date) === selectedDate);
  const monthDays = getCalendarDays(cursor);
  const weekDays = getWeekDays(new Date(`${selectedDate}T12:00:00`));
  const upcomingItems = filteredItems.filter((item) => item.date >= new Date()).slice(0, 8);
  const overdueTasks = tasks.filter((task) => {
    const dueDate = parseDate(task.due_date);
    return dueDate && task.status !== TaskStatus.DONE && dueDate < new Date();
  });

  const handlePrevious = () => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  };

  const handleNext = () => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCursor(today);
    setSelectedDate(dateKey(today));
  };

  const toggleAttendee = (userId: number) => {
    setSelectedAttendees((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const resetEventForm = () => {
    setTitle("");
    setEventType("MEETING");
    setEventDate(selectedDate);
    setStartTime("09:00");
    setEndTime("10:00");
    setMeetingUrl("");
    setLocation("");
    setDescription("");
    setSelectedAttendees(currentUser?.id ? [currentUser.id] : []);
  };

  const handleCreateEvent = async () => {
    if (!project || !title.trim()) return;

    const startsAt = `${eventDate}T${startTime}:00`;
    const endsAt = `${eventDate}T${endTime}:00`;

    setCreatingEvent(true);
    try {
      await createProjectCalendarEvent(project.id, {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        starts_at: startsAt,
        ends_at: endsAt,
        location: location.trim() || null,
        meeting_url: meetingUrl.trim() || null,
        attendee_ids: selectedAttendees,
      });

      toast.success("Calendar event created");
      setEventDialogOpen(false);
      resetEventForm();
      await loadCalendar();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not create calendar event."));
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;

    setDeletingEvent(true);
    try {
      await deleteCalendarEvent(eventToDelete.id);
      toast.success("Calendar event deleted");
      setEventToDelete(null);
      await loadCalendar();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete calendar event."));
    } finally {
      setDeletingEvent(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-blue-500">
        <Loader2 className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="bg-blue-600 text-white">{project.key}</Badge>
                <Badge variant="outline" className="border-slate-700 bg-slate-950/70 text-slate-300">
                  Calendar
                </Badge>
                {overdueTasks.length > 0 && (
                  <Badge variant="outline" className="border-rose-500/25 bg-rose-500/10 text-rose-300">
                    {overdueTasks.length} overdue
                  </Badge>
                )}
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
                Team Calendar
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                See task deadlines, sprint ceremonies, meetings and personal workload in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900"
                onClick={handleToday}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Today
              </Button>

              <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    New Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[92vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-50 sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create calendar event</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Schedule meetings, ceremonies or focus sessions with project members.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-5 py-2">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Sprint planning"
                        className="h-11 border-slate-700 bg-slate-900"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-[200px_1fr_1fr]">
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select value={eventType} onValueChange={(value) => setEventType(value as CalendarEventType)}>
                          <SelectTrigger className="h-11 border-slate-700 bg-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            {eventTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={eventDate}
                          onChange={(event) => setEventDate(event.target.value)}
                          className="h-11 border-slate-700 bg-slate-900"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Start</Label>
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            className="h-11 border-slate-700 bg-slate-900"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End</Label>
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                            className="h-11 border-slate-700 bg-slate-900"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Meeting link</Label>
                        <div className="relative">
                          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            value={meetingUrl}
                            onChange={(event) => setMeetingUrl(event.target.value)}
                            placeholder="https://meet.google.com/..."
                            className="h-11 border-slate-700 bg-slate-900 pl-9"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Location</Label>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                          <Input
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                            placeholder="Remote / Room A"
                            className="h-11 border-slate-700 bg-slate-900 pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Agenda, expectations, notes..."
                        className="min-h-24 border-slate-700 bg-slate-900"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <Label>Attendees</Label>
                        <span className="text-xs text-slate-500">
                          {selectedAttendees.length} selected
                        </span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {members.map((member) => {
                          const selected = selectedAttendees.includes(member.user.id);

                          return (
                            <button
                              key={member.membership_id}
                              type="button"
                              onClick={() => toggleAttendee(member.user.id)}
                              className={cn(
                                "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
                                selected
                                  ? "border-blue-500/35 bg-blue-500/10 text-blue-100"
                                  : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700"
                              )}
                            >
                              <Avatar className="h-9 w-9 border border-slate-700">
                                <AvatarFallback className="bg-slate-800 text-[10px] text-slate-200">
                                  {getInitials(memberName(member))}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">
                                  {memberName(member)}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {member.role?.name || "Member"}
                                </p>
                              </div>
                              {selected && <CheckCircle2 className="h-4 w-4 text-blue-300" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setEventDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={creatingEvent || !title.trim()}
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={handleCreateEvent}
                    >
                      {creatingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Create Event
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <Video className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Events</p>
            <p className="mt-1 text-2xl font-semibold text-white">{events.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <ListChecks className="mb-3 h-5 w-5 text-emerald-300" />
            <p className="text-sm text-slate-500">Task deadlines</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {tasks.filter((task) => task.due_date).length}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <AlertTriangle className="mb-3 h-5 w-5 text-rose-300" />
            <p className="text-sm text-slate-500">Overdue</p>
            <p className="mt-1 text-2xl font-semibold text-white">{overdueTasks.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <Users2 className="mb-3 h-5 w-5 text-violet-300" />
            <p className="text-sm text-slate-500">Members</p>
            <p className="mt-1 text-2xl font-semibold text-white">{members.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-blue-400" />
                    {formatMonth(cursor)}
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredItems.length} visible calendar items after filters.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-700 bg-slate-950/60"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-slate-700 bg-slate-950/60"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)}>
                    <TabsList className="border border-slate-800 bg-slate-950">
                      <TabsTrigger value="month" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <LayoutGrid className="h-4 w-4" />
                        Month
                      </TabsTrigger>
                      <TabsTrigger value="week" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Week
                      </TabsTrigger>
                      <TabsTrigger value="agenda" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Agenda
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)}>
                <TabsContent value="month" className="mt-0">
                  <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-slate-800">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-500">
                        {day}
                      </div>
                    ))}

                    {monthDays.map((day) => {
                      const key = dateKey(day);
                      const dayItems = filteredItems.filter((item) => dateKey(item.date) === key);
                      const isCurrentMonth = day.getMonth() === cursor.getMonth();
                      const isSelected = key === selectedDate;
                      const isToday = key === dateKey(new Date());

                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedDate(key)}
                          className={cn(
                            "min-h-32 border-b border-r border-slate-800 bg-slate-950/40 p-3 text-left transition hover:bg-slate-900",
                            !isCurrentMonth && "opacity-45",
                            isSelected && "bg-blue-500/10 ring-1 ring-inset ring-blue-500/35"
                          )}
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <span
                              className={cn(
                                "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                                isToday ? "bg-blue-600 text-white" : "text-slate-300"
                              )}
                            >
                              {day.getDate()}
                            </span>
                            {dayItems.length > 0 && (
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                                {dayItems.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {dayItems.slice(0, 3).map((item) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "truncate rounded-lg px-2 py-1 text-[11px]",
                                  item.kind === "task"
                                    ? "bg-emerald-500/10 text-emerald-200"
                                    : "bg-blue-500/10 text-blue-200"
                                )}
                              >
                                {item.kind === "task" ? item.task.key : item.event.event_type} · {item.title}
                              </div>
                            ))}
                            {dayItems.length > 3 && (
                              <p className="px-1 text-[11px] text-slate-500">
                                +{dayItems.length - 3} more
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="week" className="mt-0">
                  <div className="grid gap-3 md:grid-cols-7">
                    {weekDays.map((day) => {
                      const key = dateKey(day);
                      const dayItems = filteredItems.filter((item) => dateKey(item.date) === key);

                      return (
                        <div
                          key={key}
                          className={cn(
                            "min-h-80 rounded-2xl border border-slate-800 bg-slate-950/60 p-3",
                            key === selectedDate && "border-blue-500/35 bg-blue-500/10"
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDate(key)}
                            className="mb-3 w-full rounded-xl bg-slate-900 px-3 py-2 text-left transition hover:bg-slate-800"
                          >
                            <p className="text-xs text-slate-500">
                              {day.toLocaleDateString([], { weekday: "short" })}
                            </p>
                            <p className="text-lg font-semibold text-white">{day.getDate()}</p>
                          </button>
                          <div className="space-y-2">
                            {dayItems.map((item) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "rounded-xl px-3 py-2 text-xs",
                                  item.kind === "task"
                                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                                    : "border border-blue-500/20 bg-blue-500/10 text-blue-100"
                                )}
                              >
                                <p className="font-medium">{formatTime(item.date)}</p>
                                <p className="mt-1 line-clamp-2">{item.title}</p>
                              </div>
                            ))}
                            {dayItems.length === 0 && (
                              <p className="rounded-xl border border-dashed border-slate-800 p-3 text-xs text-slate-600">
                                No items
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="agenda" className="mt-0">
                  <div className="space-y-3">
                    {filteredItems.map((item) => (
                      <CalendarItemCard
                        key={item.id}
                        item={item}
                        memberMap={memberMap}
                        onDeleteEvent={setEventToDelete}
                      />
                    ))}

                    {filteredItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                        <p className="font-medium text-slate-300">No calendar items</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Create a meeting or add target dates to tasks.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-5 w-5 text-blue-400" />
                {new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {selectedDayItems.map((item) => (
                <CalendarItemCard
                  key={item.id}
                  item={item}
                  memberMap={memberMap}
                  onDeleteEvent={setEventToDelete}
                />
              ))}

              {selectedDayItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-6 text-sm text-slate-500">
                  Nothing planned for this day.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users2 className="h-5 w-5 text-violet-300" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>Member</Label>
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">All members</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.membership_id} value={String(member.user.id)}>
                        {memberName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Item type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                    <SelectItem value="all">Everything</SelectItem>
                    <SelectItem value="tasks">Task deadlines</SelectItem>
                    <SelectItem value="events">Calendar events</SelectItem>
                    {eventTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                className={cn(
                  "w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900",
                  onlyMine && "border-blue-500/35 bg-blue-500/10 text-blue-200"
                )}
                onClick={() => setOnlyMine((value) => !value)}
              >
                <UserRound className="mr-2 h-4 w-4" />
                {onlyMine ? "Showing my schedule" : "Show only my schedule"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
            <CardHeader className="border-b border-slate-800/80">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock3 className="h-5 w-5 text-emerald-300" />
                Upcoming
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {upcomingItems.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border text-[10px]",
                        item.kind === "task"
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          : eventTypeClass[item.event.event_type] || eventTypeClass.OTHER
                      )}
                    >
                      {item.kind === "task" ? "TASK" : item.event.event_type}
                    </Badge>
                    <span className="text-xs text-slate-500">{formatDateTime(item.date)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                </div>
              ))}

              {upcomingItems.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                  No upcoming items with the current filters.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </section>

      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => !open && setEventToDelete(null)}
        title="Delete calendar event?"
        description="This removes the event from the team calendar. Task deadlines are not affected."
        confirmLabel="Delete Event"
        destructive
        loading={deletingEvent}
        onConfirm={handleDeleteEvent}
      />
    </div>
  );
}
