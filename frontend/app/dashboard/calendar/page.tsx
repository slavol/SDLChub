"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  Link2,
  ListChecks,
  Loader2,
  MapPin,
  Plus,
  Repeat,
  UserRound,
  Users2,
  Video,
} from "lucide-react";
import { toast } from "sonner";

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
import { WorkspaceLoadingSkeleton } from "@/components/dashboard/workspace-loading-skeleton";
import { UserAvatar } from "@/components/user-avatar";
import { useProjectPermissions } from "@/hooks/use-project-permissions";
import { useDebouncedRealtimeEvent } from "@/hooks/use-realtime-event";
import { getApiErrorMessage } from "@/lib/api-error";
import { pickWorkspaceProject } from "@/lib/project-selection";
import { cn } from "@/lib/utils";
import {
  CalendarAvailability,
  CalendarAvailabilityStatus,
  CalendarEvent,
  CalendarEventType,
  createProjectCalendarAvailability,
  createProjectCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEventSeries,
  deleteProjectCalendarAvailability,
  getProjectCalendarAvailability,
  getProjectCalendarEvents,
  updateProjectCalendarAvailability,
  updateProjectCalendarEvent,
} from "@/services/calendar";
import {
  getMyProjects,
  getProjectMembers,
  Project,
  ProjectMember,
} from "@/services/project";
import { getProjectTasks, Task, TaskStatus } from "@/services/task";
import { getProjectSprints, Sprint } from "@/services/sprint";
import { generateDueTaskReminders } from "@/services/notification";
import { useAuthStore } from "@/store/use-auth-store";
import { useProjectStore } from "@/store/use-project-store";
import { CalendarItemCard } from "./calendar-item-card";
import {
  addDays,
  availabilityLabel,
  availabilityStatusOptions,
  CalendarFeedItem,
  CalendarView,
  combineDateAndTime,
  dateKey,
  eventTypes,
  feedItemLabel,
  feedItemTone,
  formatDateTime,
  formatMonth,
  formatTime,
  getCalendarDays,
  getWeekDays,
  memberName,
  parseDate,
  rangesOverlap,
  recurrenceOptions,
  RecurrenceMode,
  toInputDate,
  toInputTime,
} from "./calendar-utils";

export default function CalendarPage() {
  const currentUser = useAuthStore((state) => state.user);
  const { currentProject, setCurrentProject } = useProjectStore();

  const [project, setProject] = useState<Project | null>(currentProject);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [availabilityBlocks, setAvailabilityBlocks] = useState<CalendarAvailability[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [memberFilter, setMemberFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyMine, setOnlyMine] = useState(false);

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [generatingReminders, setGeneratingReminders] = useState(false);
  const [lastReminderResult, setLastReminderResult] = useState<{
    created: number;
    due_task_created?: number;
    calendar_created?: number;
    calendar_lookahead_minutes?: number;
  } | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const [deleteEntireSeries, setDeleteEntireSeries] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(false);

  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<CalendarAvailability | null>(null);
  const [availabilityToDelete, setAvailabilityToDelete] = useState<CalendarAvailability | null>(null);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [deletingAvailability, setDeletingAvailability] = useState(false);

  const [availabilityUserId, setAvailabilityUserId] = useState<number | null>(currentUser?.id || null);
  const [availabilityStatus, setAvailabilityStatus] = useState<CalendarAvailabilityStatus>("VACATION");
  const [availabilityTitle, setAvailabilityTitle] = useState("");
  const [availabilityStartDate, setAvailabilityStartDate] = useState(selectedDate);
  const [availabilityEndDate, setAvailabilityEndDate] = useState(selectedDate);
  const [availabilityStartTime, setAvailabilityStartTime] = useState("09:00");
  const [availabilityEndTime, setAvailabilityEndTime] = useState("17:00");
  const [availabilityAllDay, setAvailabilityAllDay] = useState(true);
  const [availabilityNote, setAvailabilityNote] = useState("");

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("MEETING");
  const [eventDate, setEventDate] = useState(selectedDate);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [selectedAttendees, setSelectedAttendees] = useState<number[]>([]);

  const { can } = useProjectPermissions(project?.id || currentProject?.id);
  const canCreateCalendarEvent = can("CALENDAR_CREATE");
  const canUpdateCalendarEvent = can("CALENDAR_UPDATE");
  const canDeleteCalendarEvent = can("CALENDAR_DELETE");
  const canCreateAvailability = Boolean(currentUser?.id);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.user.id, member])),
    [members]
  );

  const loadCalendar = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      let selectedProject = currentProject;

      if (!selectedProject) {
        const projects = await getMyProjects();
        selectedProject = pickWorkspaceProject(projects, currentProject);

        if (selectedProject) {
          setCurrentProject(selectedProject);
        }
      }

      setProject(selectedProject);

      if (!selectedProject) {
        setMembers([]);
        setTasks([]);
        setEvents([]);
        setAvailabilityBlocks([]);
        return;
      }

      const usesSprints = selectedProject.methodology !== "KANBAN";
      const [projectMembers, projectTasks, projectEvents, projectAvailability, projectSprints] = await Promise.all([
        getProjectMembers(selectedProject.id),
        getProjectTasks(selectedProject.id, "backlog"),
        getProjectCalendarEvents(selectedProject.id),
        getProjectCalendarAvailability(selectedProject.id),
        usesSprints ? getProjectSprints(selectedProject.id) : Promise.resolve([]),
      ]);

      setMembers(projectMembers);
      setTasks(projectTasks);
      setEvents(projectEvents);
      setAvailabilityBlocks(projectAvailability);
      setSprints(projectSprints);

      if (currentUser?.id) {
        setSelectedAttendees((current) =>
          current.length === 0 ? [currentUser.id] : current
        );
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load calendar."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [currentProject, currentUser?.id, setCurrentProject]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  useDebouncedRealtimeEvent(
    () => loadCalendar(false),
    [project?.id, loadCalendar],
    350,
    (message) => {
      if (!project?.id || (message.project_id && message.project_id !== project.id)) return false;
      return (
        message.type === "calendar.changed" ||
        message.type === "task.changed" ||
        message.type === "sprint.changed"
      );
    }
  );

  useEffect(() => {
    if (eventDialogOpen && !editingEvent) {
      setEventDate(selectedDate);
    }
  }, [editingEvent, eventDialogOpen, selectedDate]);

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

    const availabilityItems: CalendarFeedItem[] = availabilityBlocks
      .map((block) => {
        const startsAt = parseDate(block.starts_at);
        if (!startsAt) return null;

        const user = memberMap.get(block.user_id);

        return {
          id: `availability-${block.id}`,
          kind: "availability" as const,
          date: startsAt,
          title: block.title || availabilityLabel(block.status),
          availability: block,
          userName: block.user_name || memberName(user),
        };
      })
      .filter(Boolean) as CalendarFeedItem[];

    const sprintItems: CalendarFeedItem[] = sprints.flatMap((sprint) => {
      const items: CalendarFeedItem[] = [];
      const startDate = parseDate(sprint.start_date);
      const endDate = parseDate(sprint.end_date);

      if (startDate) {
        items.push({
          id: `sprint-${sprint.id}-start`,
          kind: "sprint",
          date: startDate,
          title: `${sprint.name} starts`,
          sprint,
          milestone: "START",
        });
      }

      if (endDate) {
        items.push({
          id: `sprint-${sprint.id}-end`,
          kind: "sprint",
          date: endDate,
          title: `${sprint.name} ends`,
          sprint,
          milestone: "END",
        });
      }

      return items;
    });

    return [...taskItems, ...eventItems, ...availabilityItems, ...sprintItems].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [availabilityBlocks, events, memberMap, sprints, tasks]);

  const filteredItems = useMemo(() => {
    const selectedMemberId = memberFilter === "all" ? null : Number(memberFilter);
    const currentUserId = currentUser?.id;

    return feedItems.filter((item) => {
      if (typeFilter === "tasks" && item.kind !== "task") return false;
      if (typeFilter === "events" && item.kind !== "event") return false;
      if (typeFilter === "sprints" && item.kind !== "sprint") return false;
      if (typeFilter === "availability" && item.kind !== "availability") return false;

      if (typeFilter.startsWith("availability:")) {
        const selectedStatus = typeFilter.replace("availability:", "");
        if (item.kind !== "availability" || item.availability.status !== selectedStatus) return false;
      }

      if (
        !["all", "tasks", "events", "sprints", "availability"].includes(typeFilter) &&
        !typeFilter.startsWith("availability:") &&
        (item.kind !== "event" || item.event.event_type !== typeFilter)
      ) {
        return false;
      }

      if (item.kind === "sprint") return true;

      if (selectedMemberId) {
        if (item.kind === "task") return item.task.assignee_id === selectedMemberId;
        if (item.kind === "availability") return item.availability.user_id === selectedMemberId;
        return item.event.attendee_ids.includes(selectedMemberId) || item.event.created_by_id === selectedMemberId;
      }

      if (onlyMine && currentUserId) {
        if (item.kind === "task") return item.task.assignee_id === currentUserId;
        if (item.kind === "availability") return item.availability.user_id === currentUserId;
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
  const activeTimeOffBlocks = availabilityBlocks.filter((block) =>
    ["VACATION", "SICK_LEAVE", "UNAVAILABLE"].includes(String(block.status))
  );

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

  const applyDailyStandupPreset = () => {
    const until = addDays(new Date(`${eventDate}T12:00:00`), 14);

    if (!title.trim()) {
      setTitle("Daily Standup");
    }

    setEventType("DAILY");
    setStartTime("09:15");
    setEndTime("09:30");
    setRecurrenceMode("weekdays");
    setRecurrenceUntil(toInputDate(until));
    setSelectedAttendees(members.map((member) => member.user.id));
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
    setRecurrenceMode("none");
    setRecurrenceUntil("");
    setSelectedAttendees(currentUser?.id ? [currentUser.id] : []);
    setEditingEvent(null);
  };

  const fillEventForm = (event: CalendarEvent) => {
    const startsAt = parseDate(event.starts_at) || new Date();
    const endsAt = parseDate(event.ends_at) || startsAt;

    setTitle(event.title);
    setEventType(event.event_type as CalendarEventType);
    setEventDate(toInputDate(startsAt));
    setStartTime(toInputTime(startsAt));
    setEndTime(toInputTime(endsAt));
    setMeetingUrl(event.meeting_url || "");
    setLocation(event.location || "");
    setDescription(event.description || "");
    setRecurrenceMode("none");
    setRecurrenceUntil("");
    setSelectedAttendees(event.attendee_ids || []);
  };

  const openCreateEventDialog = () => {
    if (!canCreateCalendarEvent) {
      toast.error("You do not have permission to create calendar events.");
      return;
    }

    resetEventForm();
    setEventDate(selectedDate);
    setEventDialogOpen(true);
  };

  const openEditEventDialog = (event: CalendarEvent) => {
    if (!(canUpdateCalendarEvent || event.created_by_id === currentUser?.id)) {
      toast.error("You do not have permission to edit this calendar event.");
      return;
    }

    setEditingEvent(event);
    fillEventForm(event);
    setEventDialogOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!project || !title.trim()) return;

    if (!editingEvent && !canCreateCalendarEvent) {
      toast.error("You do not have permission to create calendar events.");
      return;
    }

    if (editingEvent && !(canUpdateCalendarEvent || editingEvent.created_by_id === currentUser?.id)) {
      toast.error("You do not have permission to edit this calendar event.");
      return;
    }

    setCreatingEvent(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        starts_at: combineDateAndTime(new Date(`${eventDate}T12:00:00`), startTime),
        ends_at: combineDateAndTime(new Date(`${eventDate}T12:00:00`), endTime),
        location: location.trim() || null,
        meeting_url: meetingUrl.trim() || null,
        attendee_ids: selectedAttendees,
      };

      if (editingEvent) {
        await updateProjectCalendarEvent(editingEvent.id, payload);
      } else {
        await createProjectCalendarEvent(project.id, {
          ...payload,
          recurrence_mode: recurrenceMode,
          recurrence_until:
            recurrenceMode === "none"
              ? null
              : combineDateAndTime(new Date(`${recurrenceUntil || eventDate}T12:00:00`), endTime),
        });
      }

      toast.success(
        editingEvent
          ? "Calendar event updated"
          : recurrenceMode === "none"
            ? "Calendar event created"
            : "Recurring event series created"
      );
      setEventDialogOpen(false);
      resetEventForm();
      await loadCalendar(false);
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
      if (deleteEntireSeries && eventToDelete.recurrence_series_id) {
        const result = await deleteCalendarEventSeries(eventToDelete.id);
        toast.success(`${result.deleted} event${result.deleted === 1 ? "" : "s"} deleted`);
      } else {
        await deleteCalendarEvent(eventToDelete.id);
        toast.success("Calendar event deleted");
      }
      setEventToDelete(null);
      setDeleteEntireSeries(false);
      await loadCalendar(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete calendar event."));
    } finally {
      setDeletingEvent(false);
    }
  };

  const openDeleteSeriesDialog = (event: CalendarEvent) => {
    setDeleteEntireSeries(true);
    setEventToDelete(event);
  };

  const canManageAvailability = useCallback(
    (block: CalendarAvailability) =>
      canUpdateCalendarEvent ||
      block.user_id === currentUser?.id ||
      block.created_by_id === currentUser?.id,
    [canUpdateCalendarEvent, currentUser?.id]
  );

  const resetAvailabilityForm = () => {
    setEditingAvailability(null);
    setAvailabilityUserId(currentUser?.id || null);
    setAvailabilityStatus("VACATION");
    setAvailabilityTitle("");
    setAvailabilityStartDate(selectedDate);
    setAvailabilityEndDate(selectedDate);
    setAvailabilityStartTime("09:00");
    setAvailabilityEndTime("17:00");
    setAvailabilityAllDay(true);
    setAvailabilityNote("");
  };

  const fillAvailabilityForm = (block: CalendarAvailability) => {
    const startsAt = parseDate(block.starts_at) || new Date();
    const endsAt = parseDate(block.ends_at) || startsAt;

    setEditingAvailability(block);
    setAvailabilityUserId(block.user_id);
    setAvailabilityStatus(block.status as CalendarAvailabilityStatus);
    setAvailabilityTitle(block.title || "");
    setAvailabilityStartDate(toInputDate(startsAt));
    setAvailabilityEndDate(toInputDate(endsAt));
    setAvailabilityStartTime(toInputTime(startsAt));
    setAvailabilityEndTime(toInputTime(endsAt));
    setAvailabilityAllDay(Boolean(block.all_day));
    setAvailabilityNote(block.note || "");
  };

  const openCreateAvailabilityDialog = () => {
    if (!canCreateAvailability) {
      toast.error("You must be signed in to create availability blocks.");
      return;
    }

    resetAvailabilityForm();
    setAvailabilityDialogOpen(true);
  };

  const openEditAvailabilityDialog = (block: CalendarAvailability) => {
    if (!canManageAvailability(block)) {
      toast.error("You can edit only your own time off, unless you can manage calendar events.");
      return;
    }

    fillAvailabilityForm(block);
    setAvailabilityDialogOpen(true);
  };

  const buildAvailabilityPayload = () => {
    const startDate = new Date(`${availabilityStartDate}T12:00:00`);
    const endDate = new Date(`${availabilityEndDate || availabilityStartDate}T12:00:00`);

    return {
      user_id: availabilityUserId,
      status: availabilityStatus,
      title: availabilityTitle.trim() || null,
      starts_at: availabilityAllDay
        ? `${toInputDate(startDate)}T00:00:00`
        : combineDateAndTime(startDate, availabilityStartTime),
      ends_at: availabilityAllDay
        ? `${toInputDate(endDate)}T23:59:59`
        : combineDateAndTime(endDate, availabilityEndTime),
      all_day: availabilityAllDay,
      note: availabilityNote.trim() || null,
    };
  };

  const handleSaveAvailability = async () => {
    if (!project || !availabilityUserId) return;

    if (availabilityUserId !== currentUser?.id && !canUpdateCalendarEvent) {
      toast.error("You need calendar update permission to manage another member's availability.");
      return;
    }

    setSavingAvailability(true);
    try {
      const payload = buildAvailabilityPayload();

      if (editingAvailability) {
        await updateProjectCalendarAvailability(editingAvailability.id, payload);
        toast.success("Availability updated");
      } else {
        await createProjectCalendarAvailability(project.id, payload);
        toast.success("Time off added");
      }

      setAvailabilityDialogOpen(false);
      resetAvailabilityForm();
      await loadCalendar(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not save availability."));
    } finally {
      setSavingAvailability(false);
    }
  };

  const handleDeleteAvailability = async () => {
    if (!availabilityToDelete) return;

    setDeletingAvailability(true);
    try {
      await deleteProjectCalendarAvailability(availabilityToDelete.id);
      toast.success("Availability block deleted");
      setAvailabilityToDelete(null);
      await loadCalendar(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not delete availability."));
    } finally {
      setDeletingAvailability(false);
    }
  };

  const eventAvailabilityConflicts = useMemo(() => {
    const start = parseDate(combineDateAndTime(new Date(`${eventDate}T12:00:00`), startTime));
    const end = parseDate(combineDateAndTime(new Date(`${eventDate}T12:00:00`), endTime));

    if (!start || !end || end <= start || selectedAttendees.length === 0) return [];

    return availabilityBlocks.filter((block) => {
      if (!selectedAttendees.includes(block.user_id)) return false;
      if (block.status === "AVAILABLE") return false;

      const blockStart = parseDate(block.starts_at);
      const blockEnd = parseDate(block.ends_at);
      if (!blockStart || !blockEnd) return false;

      return rangesOverlap(start, end, blockStart, blockEnd);
    });
  }, [availabilityBlocks, eventDate, endTime, selectedAttendees, startTime]);

  const handleGenerateReminders = async () => {
    if (!project) return;

    setGeneratingReminders(true);
    try {
      const result = await generateDueTaskReminders(project.id);
      setLastReminderResult(result);
      toast.success(
        result.created > 0
          ? `${result.created} reminder${result.created === 1 ? "" : "s"} created`
          : "No new task or calendar reminders needed"
      );
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not generate reminders."));
    } finally {
      setGeneratingReminders(false);
    }
  };

  if (loading) {
    return <WorkspaceLoadingSkeleton metricCount={4} panelCount={2} withSidePanel />;
  }

  if (!project) {
    return <div className="p-8 text-slate-300">No project selected.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
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
              <h1 className="break-words text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">
                Team Calendar
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                See task deadlines, sprint ceremonies, meetings, availability and time off in one place.
              </p>
            </div>

            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 sm:w-auto"
                onClick={handleToday}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Today
              </Button>

              <Button
                variant="outline"
                className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                disabled={generatingReminders}
                onClick={handleGenerateReminders}
              >
                {generatingReminders ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BellRing className="mr-2 h-4 w-4" />
                )}
                Smart reminders
              </Button>

              <Dialog
                open={availabilityDialogOpen}
                onOpenChange={(open) => {
                  setAvailabilityDialogOpen(open);

                  if (!open) {
                    resetAvailabilityForm();
                  }
                }}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900 sm:w-auto"
                  disabled={!canCreateAvailability}
                  onClick={openCreateAvailabilityDialog}
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  New Time Off
                </Button>
                <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingAvailability ? "Edit availability" : "Add time off / availability"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Register vacations, sick leave, unavailable intervals or focus time for project members.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-5 py-2">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Member</Label>
                        <Select
                          value={availabilityUserId ? String(availabilityUserId) : ""}
                          onValueChange={(value) => setAvailabilityUserId(Number(value))}
                        >
                          <SelectTrigger className="h-11 border-slate-700 bg-slate-900">
                            <SelectValue placeholder="Select member" />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            {members.map((member) => (
                              <SelectItem
                                key={member.membership_id}
                                value={String(member.user.id)}
                                disabled={member.user.id !== currentUser?.id && !canUpdateCalendarEvent}
                              >
                                {memberName(member)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {!canUpdateCalendarEvent && (
                          <p className="text-xs text-slate-500">
                            You can add or edit only your own availability.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select
                          value={availabilityStatus}
                          onValueChange={(value) => setAvailabilityStatus(value as CalendarAvailabilityStatus)}
                        >
                          <SelectTrigger className="h-11 border-slate-700 bg-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                            {availabilityStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-slate-500">
                          {availabilityStatusOptions.find((option) => option.value === availabilityStatus)?.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={availabilityTitle}
                        onChange={(event) => setAvailabilityTitle(event.target.value)}
                        placeholder="Vacation, conference day, unavailable..."
                        className="h-11 border-slate-700 bg-slate-900"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Start date</Label>
                        <Input
                          type="date"
                          value={availabilityStartDate}
                          onChange={(event) => setAvailabilityStartDate(event.target.value)}
                          className="h-11 border-slate-700 bg-slate-900"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End date</Label>
                        <Input
                          type="date"
                          value={availabilityEndDate}
                          min={availabilityStartDate}
                          onChange={(event) => setAvailabilityEndDate(event.target.value)}
                          className="h-11 border-slate-700 bg-slate-900"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        "w-fit border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800",
                        availabilityAllDay && "border-blue-500/35 bg-blue-500/10 text-blue-200"
                      )}
                      onClick={() => setAvailabilityAllDay((value) => !value)}
                    >
                      {availabilityAllDay ? "All day enabled" : "Use specific hours"}
                    </Button>

                    {!availabilityAllDay && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Start</Label>
                          <Input
                            type="time"
                            value={availabilityStartTime}
                            onChange={(event) => setAvailabilityStartTime(event.target.value)}
                            className="h-11 border-slate-700 bg-slate-900"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End</Label>
                          <Input
                            type="time"
                            value={availabilityEndTime}
                            onChange={(event) => setAvailabilityEndTime(event.target.value)}
                            className="h-11 border-slate-700 bg-slate-900"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Reason / note</Label>
                      <Textarea
                        value={availabilityNote}
                        onChange={(event) => setAvailabilityNote(event.target.value)}
                        placeholder="Optional note visible to the project team..."
                        className="min-h-24 border-slate-700 bg-slate-900"
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-slate-400 hover:text-white"
                      onClick={() => setAvailabilityDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={savingAvailability || !availabilityUserId}
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={handleSaveAvailability}
                    >
                      {savingAvailability ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingAvailability ? "Save Changes" : "Add Time Off"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog
                open={eventDialogOpen}
                onOpenChange={(open) => {
                  setEventDialogOpen(open);

                  if (!open) {
                    resetEventForm();
                  }
                }}
              >
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canCreateCalendarEvent}
                  title={!canCreateCalendarEvent ? "You do not have permission to create calendar events." : undefined}
                  onClick={openCreateEventDialog}
                >
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  New Event
                </Button>
                <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEvent ? "Edit calendar event" : "Create calendar event"}
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                      {editingEvent
                        ? "Update the event details, attendees and meeting information."
                        : "Schedule meetings, ceremonies or focus sessions with project members."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-5 py-2">
                    <div className="space-y-2">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Label>Title</Label>
                        {!editingEvent && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800"
                            onClick={applyDailyStandupPreset}
                          >
                            <Repeat className="mr-1.5 h-3.5 w-3.5" />
                            Daily Standup preset
                          </Button>
                        )}
                      </div>
                      <Input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Sprint planning"
                        className="h-11 border-slate-700 bg-slate-900"
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-900/45 p-3 sm:p-4">
                      <div className="grid gap-4 md:grid-cols-[minmax(9rem,0.65fr)_minmax(14rem,1fr)]">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={eventType} onValueChange={(value) => setEventType(value as CalendarEventType)}>
                            <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
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
                            className="h-11 border-slate-700 bg-slate-950"
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Start</Label>
                          <Input
                            type="time"
                            value={startTime}
                            onChange={(event) => setStartTime(event.target.value)}
                            className="h-11 min-w-0 border-slate-700 bg-slate-950"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End</Label>
                          <Input
                            type="time"
                            value={endTime}
                            onChange={(event) => setEndTime(event.target.value)}
                            className="h-11 min-w-0 border-slate-700 bg-slate-950"
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

                    {!editingEvent && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <div className="mb-4 flex items-center gap-2">
                          <Repeat className="h-4 w-4 text-blue-300" />
                          <div>
                            <Label>Repeat</Label>
                            <p className="text-xs text-slate-500">
                              Create a persistent recurring series for ceremonies like Daily Standup.
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.72fr)]">
                          <Select
                            value={recurrenceMode}
                            onValueChange={(value) => setRecurrenceMode(value as RecurrenceMode)}
                          >
                            <SelectTrigger className="h-11 border-slate-700 bg-slate-950">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                              {recurrenceOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Input
                            type="date"
                            value={recurrenceUntil}
                            disabled={recurrenceMode === "none"}
                            onChange={(event) => setRecurrenceUntil(event.target.value)}
                            className="h-11 border-slate-700 bg-slate-950 disabled:opacity-50"
                            min={eventDate}
                          />
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          {recurrenceOptions.find((option) => option.value === recurrenceMode)?.description}
                          {recurrenceMode !== "none" && " The series is stored on the backend, up to 60 occurrences."}
                        </p>
                      </div>
                    )}

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
                              <UserAvatar
                                name={member.user.full_name}
                                email={member.user.email}
                                src={member.user.avatar_url}
                                className="h-9 w-9"
                                fallbackClassName="bg-slate-800 text-[10px] text-slate-200"
                              />
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

                    {eventAvailabilityConflicts.length > 0 && (
                      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                          <div>
                            <p className="font-semibold text-amber-100">Availability warning</p>
                            <p className="mt-1 text-sm text-amber-100/80">
                              This event overlaps with time off or unavailable intervals for{" "}
                              {eventAvailabilityConflicts.length} selected attendee
                              {eventAvailabilityConflicts.length === 1 ? "" : "s"}.
                            </p>
                            <div className="mt-3 space-y-2">
                              {eventAvailabilityConflicts.slice(0, 3).map((block) => (
                                <div key={block.id} className="rounded-xl border border-amber-400/20 bg-slate-950/50 px-3 py-2 text-xs text-amber-50/80">
                                  <strong>{block.user_name || block.user_email || `User #${block.user_id}`}</strong>
                                  {" · "}
                                  {availabilityLabel(block.status)}
                                  {" · "}
                                  {block.all_day
                                    ? "All day"
                                    : `${formatTime(new Date(block.starts_at))} - ${formatTime(new Date(block.ends_at))}`}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter className="gap-2 sm:gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-slate-400 hover:text-white sm:w-auto"
                      onClick={() => setEventDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      disabled={
                        creatingEvent ||
                        !title.trim() ||
                        (editingEvent
                          ? !(canUpdateCalendarEvent || editingEvent.created_by_id === currentUser?.id)
                          : !canCreateCalendarEvent)
                      }
                      className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
                      onClick={handleSaveEvent}
                    >
                      {creatingEvent ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingEvent ? "Save Changes" : "Create Event"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <Video className="mb-3 h-5 w-5 text-blue-300" />
            <p className="text-sm text-slate-500">Events</p>
            <p className="mt-1 text-2xl font-semibold text-white">{events.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
            <CalendarClock className="mb-3 h-5 w-5 text-indigo-300" />
            <p className="text-sm text-slate-500">Sprint milestones</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {sprints.filter((sprint) => sprint.start_date || sprint.end_date).length}
            </p>
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
            <UserRound className="mb-3 h-5 w-5 text-sky-300" />
            <p className="text-sm text-slate-500">Time off</p>
            <p className="mt-1 text-2xl font-semibold text-white">{activeTimeOffBlocks.length}</p>
          </div>
        </div>

        {lastReminderResult && (
          <div className="border-t border-slate-800/80 bg-slate-950/45 px-5 py-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-400/10">
                  <BellRing className="h-5 w-5 text-blue-200" />
                </div>
                <div>
                  <p className="font-semibold text-white">Reminder sweep completed</p>
                  <p className="mt-1 text-sm text-slate-400">
                    Checked your due tasks and meetings starting in the next{" "}
                    {lastReminderResult.calendar_lookahead_minutes || 60} minutes.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center sm:min-w-80">
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-lg font-semibold text-white">{lastReminderResult.created}</p>
                  <p className="text-[11px] text-slate-500">total</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-lg font-semibold text-white">{lastReminderResult.due_task_created || 0}</p>
                  <p className="text-[11px] text-slate-500">tasks</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  <p className="text-lg font-semibold text-white">{lastReminderResult.calendar_created || 0}</p>
                  <p className="text-[11px] text-slate-500">events</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0 space-y-6">
          <Card className="min-w-0 overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20">
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

                <div className="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
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

                  <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)} className="min-w-0">
                    <TabsList className="grid grid-cols-4 border border-slate-800 bg-slate-950 sm:flex">
                      <TabsTrigger value="month" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        <LayoutGrid className="h-4 w-4" />
                        Month
                      </TabsTrigger>
                      <TabsTrigger value="week" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Week
                      </TabsTrigger>
                      <TabsTrigger value="day" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Day
                      </TabsTrigger>
                      <TabsTrigger value="agenda" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                        Agenda
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              <Tabs value={view} onValueChange={(value) => setView(value as CalendarView)}>
                <TabsContent value="month" className="mt-0">
                  <div className="min-w-0 overflow-hidden">
                    <div className="grid min-w-0 grid-cols-7 overflow-hidden rounded-2xl border border-slate-800">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="truncate border-b border-slate-800 bg-slate-950/80 px-1.5 py-2 text-center text-[10px] font-medium text-slate-500 sm:px-3 sm:text-left sm:text-xs">
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
                            "min-w-0 border-b border-r border-slate-800 bg-slate-950/40 p-1.5 text-left transition hover:bg-slate-900 sm:min-h-32 sm:p-3",
                            !isCurrentMonth && "opacity-45",
                            isSelected && "bg-blue-500/10 ring-1 ring-inset ring-blue-500/35"
                          )}
                        >
                          <div className="mb-2 flex items-center justify-between gap-1 sm:mb-3">
                            <span
                              className={cn(
                                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium sm:h-7 sm:w-7 sm:text-sm",
                                isToday ? "bg-blue-600 text-white" : "text-slate-300"
                              )}
                            >
                              {day.getDate()}
                            </span>
                            {dayItems.length > 0 && (
                              <span className="shrink-0 rounded-full bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300 sm:px-2">
                                {dayItems.length}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            {dayItems.slice(0, 2).map((item) => (
                              <div
                                key={item.id}
                                className={cn(
                                  "truncate rounded-md px-1.5 py-1 text-[10px] sm:rounded-lg sm:px-2 sm:text-[11px]",
                                  feedItemTone(item)
                                )}
                              >
                                {feedItemLabel(item)} · {item.title}
                              </div>
                            ))}
                            {dayItems.length > 2 && (
                              <p className="px-1 text-[11px] text-slate-500">
                                +{dayItems.length - 2} more
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    </div>
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
                                  feedItemTone(item)
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

                <TabsContent value="day" className="mt-0">
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                      <div>
                        <p className="text-sm text-slate-500">Selected day</p>
                        <h2 className="text-xl font-semibold text-white">
                          {new Date(`${selectedDate}T12:00:00`).toLocaleDateString([], {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </h2>
                      </div>
                      <Badge variant="outline" className="w-fit border-slate-700 bg-slate-900 text-slate-300">
                        {selectedDayItems.length} items
                      </Badge>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                      {selectedDayItems.map((item) => (
                        <CalendarItemCard
                          key={item.id}
                          item={item}
                          memberMap={memberMap}
                          onEditEvent={openEditEventDialog}
                          onDeleteEvent={setEventToDelete}
                          onDeleteSeries={openDeleteSeriesDialog}
                          onEditAvailability={openEditAvailabilityDialog}
                          onDeleteAvailability={setAvailabilityToDelete}
                          canEditEvent={(event) => canUpdateCalendarEvent || event.created_by_id === currentUser?.id}
                          canDeleteEvent={(event) => canDeleteCalendarEvent || event.created_by_id === currentUser?.id}
                          canManageAvailability={canManageAvailability}
                        />
                      ))}
                    </div>

                    {selectedDayItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                        <p className="font-medium text-slate-300">No items for this day</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Select another day or create a team event.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="agenda" className="mt-0">
                  <div className="space-y-3">
                    {filteredItems.map((item) => (
                      <CalendarItemCard
                        key={item.id}
                        item={item}
                        memberMap={memberMap}
                        onEditEvent={openEditEventDialog}
                        onDeleteEvent={setEventToDelete}
                        onDeleteSeries={openDeleteSeriesDialog}
                        onEditAvailability={openEditAvailabilityDialog}
                        onDeleteAvailability={setAvailabilityToDelete}
                        canEditEvent={(event) => canUpdateCalendarEvent || event.created_by_id === currentUser?.id}
                        canDeleteEvent={(event) => canDeleteCalendarEvent || event.created_by_id === currentUser?.id}
                        canManageAvailability={canManageAvailability}
                      />
                    ))}

                    {filteredItems.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                        <p className="font-medium text-slate-300">No calendar items</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {canCreateCalendarEvent
                            ? "Create a meeting or add target dates to tasks."
                            : "You can view calendar items, but your role cannot create new events."}
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
                  onEditEvent={openEditEventDialog}
                  onDeleteEvent={setEventToDelete}
                  onDeleteSeries={openDeleteSeriesDialog}
                  onEditAvailability={openEditAvailabilityDialog}
                  onDeleteAvailability={setAvailabilityToDelete}
                  canEditEvent={(event) => canUpdateCalendarEvent || event.created_by_id === currentUser?.id}
                  canDeleteEvent={(event) => canDeleteCalendarEvent || event.created_by_id === currentUser?.id}
                  canManageAvailability={canManageAvailability}
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
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5 text-emerald-300" />
                  Upcoming
                </span>
                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-200">
                  {upcomingItems.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {upcomingItems.map((item) => {
                const itemDateKey = dateKey(item.date);

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedDate(itemDateKey);
                      setCursor(item.date);
                    }}
                    className={cn(
                      "group w-full rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-left transition hover:border-blue-500/35 hover:bg-slate-950",
                      itemDateKey === selectedDate && "border-blue-500/40 bg-blue-500/10"
                    )}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Badge variant="outline" className={cn("border text-[10px]", feedItemTone(item))}>
                        {feedItemLabel(item)}
                      </Badge>
                      <span className="shrink-0 text-xs text-slate-500">{formatDateTime(item.date)}</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-blue-300" />
                    </div>
                  </button>
                );
              })}

              {upcomingItems.length === 0 && (
                <p className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                  No upcoming items with the current filters.
                </p>
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
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={member.user.full_name}
                            email={member.user.email}
                            src={member.user.avatar_url}
                            className="h-5 w-5"
                            fallbackClassName="bg-blue-900 text-[9px] text-blue-100"
                          />
                          {memberName(member)}
                        </div>
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
                    <SelectItem value="sprints">Sprint milestones</SelectItem>
                    <SelectItem value="availability">Availability / time off</SelectItem>
                    {availabilityStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={`availability:${option.value}`}>
                        {option.label}
                      </SelectItem>
                    ))}
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

        </aside>
      </section>

      <ConfirmDialog
        open={eventToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEventToDelete(null);
            setDeleteEntireSeries(false);
          }
        }}
        title={eventToDelete?.recurrence_series_id ? "Delete recurring event?" : "Delete calendar event?"}
        description={
          eventToDelete?.recurrence_series_id
            ? deleteEntireSeries
              ? "This removes every event from this recurring series. Task deadlines are not affected."
              : "This removes only this occurrence from the recurring series."
            : "This removes the event from the team calendar. Task deadlines are not affected."
        }
        confirmLabel={deleteEntireSeries ? "Delete Series" : "Delete Event"}
        destructive
        loading={deletingEvent}
        onConfirm={handleDeleteEvent}
      />

      <ConfirmDialog
        open={availabilityToDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAvailabilityToDelete(null);
          }
        }}
        title="Delete availability block?"
        description="This removes the time off / availability entry from the team calendar."
        confirmLabel="Delete Availability"
        destructive
        loading={deletingAvailability}
        onConfirm={handleDeleteAvailability}
      />
    </div>
  );
}
