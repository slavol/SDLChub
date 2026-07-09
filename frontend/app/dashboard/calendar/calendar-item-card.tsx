"use client";

import Link from "next/link";
import {
  CalendarClock,
  Clock3,
  ExternalLink,
  MapPin,
  Pencil,
  Repeat,
  Trash2,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  CalendarAvailability,
  CalendarEvent,
} from "@/services/calendar";
import type { ProjectMember } from "@/services/project";
import { TaskPriority, TaskStatus } from "@/services/task";
import {
  attendeeNames,
  availabilityLabel,
  availabilityStatusClass,
  CalendarFeedItem,
  eventTypeClass,
  formatDateTime,
  formatTime,
  getInitials,
  parseDate,
} from "./calendar-utils";

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

// Cardul de feed calendaristic acopera task-uri, sprinturi, evenimente si disponibilitate.
export function CalendarItemCard({
  item,
  memberMap,
  onEditEvent,
  onDeleteEvent,
  onDeleteSeries,
  onEditAvailability,
  onDeleteAvailability,
  canEditEvent,
  canDeleteEvent,
  canManageAvailability,
}: {
  item: CalendarFeedItem;
  memberMap: Map<number, ProjectMember>;
  onEditEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (event: CalendarEvent) => void;
  onDeleteSeries: (event: CalendarEvent) => void;
  onEditAvailability: (availability: CalendarAvailability) => void;
  onDeleteAvailability: (availability: CalendarAvailability) => void;
  canEditEvent: (event: CalendarEvent) => boolean;
  canDeleteEvent: (event: CalendarEvent) => boolean;
  canManageAvailability: (availability: CalendarAvailability) => boolean;
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

  if (item.kind === "sprint") {
    const tone =
      item.milestone === "START"
        ? "border-indigo-500/25 bg-indigo-500/10 text-indigo-200"
        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";

    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("border text-[10px]", tone)}>
            SPRINT {item.milestone}
          </Badge>
          {item.sprint.is_active && (
            <Badge variant="outline" className="border-blue-500/25 bg-blue-500/10 text-[10px] text-blue-200">
              ACTIVE
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
        {item.sprint.goal && (
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
            {item.sprint.goal}
          </p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <CalendarClock className="h-3.5 w-3.5" />
          {formatDateTime(item.date)}
        </p>
      </div>
    );
  }

  if (item.kind === "availability") {
    const block = item.availability;
    const canManage = canManageAvailability(block);
    const statusTone = availabilityStatusClass[block.status] || availabilityStatusClass.UNAVAILABLE;
    const statusLabel = availabilityLabel(block.status);
    const start = parseDate(block.starts_at) || item.date;
    const end = parseDate(block.ends_at) || start;

    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border text-[10px]", statusTone)}>
              {statusLabel}
            </Badge>
            {block.all_day && (
              <Badge variant="outline" className="border-slate-700 bg-slate-900 text-[10px] text-slate-300">
                ALL DAY
              </Badge>
            )}
          </div>
          {canManage && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:bg-blue-950/30 hover:text-blue-300"
                onClick={() => onEditAvailability(block)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:bg-red-950/30 hover:text-red-300"
                onClick={() => onDeleteAvailability(block)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>

        <p className="line-clamp-2 text-sm font-semibold text-white">
          {block.title || statusLabel}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <UserRound className="h-3.5 w-3.5" />
          {item.userName}
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          {block.all_day ? "All day" : `${formatTime(start)} - ${formatTime(end)}`}
        </p>
        {block.note && (
          <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">{block.note}</p>
        )}
      </div>
    );
  }

  const names = attendeeNames(item.event, memberMap);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("border text-[10px]", eventTypeClass[item.event.event_type] || eventTypeClass.OTHER)}
          >
            {item.event.event_type}
          </Badge>
          {item.event.recurrence_series_id && (
            <Badge variant="outline" className="border-cyan-500/25 bg-cyan-500/10 text-[10px] text-cyan-200">
              SERIES
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {canEditEvent(item.event) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-500 hover:bg-blue-950/30 hover:text-blue-300"
              onClick={() => onEditEvent(item.event)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDeleteEvent(item.event) && (
            <>
              {item.event.recurrence_series_id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-slate-500 hover:bg-cyan-950/30 hover:text-cyan-300"
                  title="Delete entire series"
                  onClick={() => onDeleteSeries(item.event)}
                >
                  <Repeat className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-500 hover:bg-red-950/30 hover:text-red-300"
                title="Delete this event"
                onClick={() => onDeleteEvent(item.event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
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
