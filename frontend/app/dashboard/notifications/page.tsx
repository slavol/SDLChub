"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock3,
  CalendarDays,
  CheckCheck,
  Loader2,
  MessageSquareText,
  RefreshCw,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceLoadingSkeleton } from "@/components/dashboard/workspace-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useRealtimeEvent } from "@/hooks/use-realtime-event";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NotificationItem,
} from "@/services/notification";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function notificationIcon(type: string) {
  if (type === "TASK_ASSIGNED") return UserRoundCheck;
  if (type === "TASK_OVERDUE") return AlertTriangle;
  if (type === "TASK_DUE_SOON") return Clock3;
  if (type === "MENTION") return MessageSquareText;
  if (type === "CALENDAR_INVITE" || type === "CALENDAR_REMINDER") return CalendarDays;
  if (type === "AI_RISK") return AlertTriangle;
  return Bell;
}

function notificationTone(type: string) {
  if (type === "TASK_ASSIGNED") return "border-blue-500/20 bg-blue-500/10 text-blue-200";
  if (type === "TASK_OVERDUE") return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  if (type === "TASK_DUE_SOON") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  if (type === "MENTION") return "border-purple-500/20 bg-purple-500/10 text-purple-200";
  if (type === "CALENDAR_INVITE" || type === "CALENDAR_REMINDER") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  if (type === "AI_RISK") return "border-orange-500/25 bg-orange-500/10 text-orange-200";
  return "border-slate-700 bg-slate-900 text-slate-300";
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const loadNotifications = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const data = await getNotifications(false, 100);
      setNotifications(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not load notifications."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useRealtimeEvent((message) => {
    if (
      message.type === "notification.created" ||
      message.type === "notification.read" ||
      message.type === "notification.read_all"
    ) {
      loadNotifications(false);
    }
  }, [loadNotifications]);

  const handleOpen = async (item: NotificationItem) => {
    if (!item.read_at) {
      try {
        const updated = await markNotificationRead(item.id);
        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id ? updated : notification
          )
        );
      } catch {
        // Navigation is still allowed; the notification can be marked later.
      }
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);

    try {
      await markAllNotificationsRead();
      await loadNotifications(false);
      toast.success("All notifications marked as read.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not mark notifications as read."));
    } finally {
      setMarkingAll(false);
    }
  };

  if (loading) {
    return <WorkspaceLoadingSkeleton metricCount={3} panelCount={1} tableRows={5} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-6 text-slate-100 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-center">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
            <Bell className="h-3.5 w-3.5" />
            Notifications
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Notification Center
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Track assignments, mentions, due-date reminders, AI risk alerts and calendar updates.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            onClick={() => loadNotifications()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button
            className="bg-blue-600 hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={markingAll || unreadCount === 0}
            onClick={handleMarkAll}
          >
            {markingAll ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="mr-2 h-4 w-4" />
            )}
            Mark all read
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Total</p>
            <p className="mt-1 text-3xl font-bold text-white">{notifications.length}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Unread</p>
            <p className="mt-1 text-3xl font-bold text-blue-300">{unreadCount}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/70">
          <CardContent className="p-5">
            <p className="text-sm text-slate-500">Read</p>
            <p className="mt-1 text-3xl font-bold text-emerald-300">
              {notifications.length - unreadCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {notifications.map((item) => {
          const Icon = notificationIcon(item.type);
          const content = (
            <Card
              className={
                item.read_at
                  ? "border-slate-800 bg-slate-900/60"
                  : "border-blue-500/30 bg-blue-500/10"
              }
            >
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 gap-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${notificationTone(item.type)}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-white">{item.title}</h2>
                      {!item.read_at && (
                        <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                          New
                        </Badge>
                      )}
                    </div>
                    {item.message && (
                      <p className="line-clamp-2 text-sm leading-6 text-slate-400">
                        {item.message}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );

          if (item.link_url) {
            return (
              <Link
                key={item.id}
                href={item.link_url}
                onClick={() => handleOpen(item)}
                className="block"
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleOpen(item)}
              className="block w-full text-left"
            >
              {content}
            </button>
          );
        })}

        {notifications.length === 0 && (
          <Card className="border-slate-800 bg-slate-900/70">
            <CardContent className="p-10 text-center">
              <Bell className="mx-auto mb-4 h-10 w-10 text-slate-600" />
              <h2 className="text-lg font-semibold text-white">No notifications yet</h2>
              <p className="mt-2 text-sm text-slate-500">
                Assignments, mentions and calendar invitations will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
