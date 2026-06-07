"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  Clock3,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ExternalLink,
  Filter,
  Inbox,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

import { WorkspaceLoadingSkeleton } from "@/components/dashboard/workspace-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedRealtimeEvent } from "@/hooks/use-realtime-event";
import { getApiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import {
  deleteNotification,
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

function notificationLabel(type: string) {
  return type
    .split("_")
    .filter(Boolean)
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [notificationToDelete, setNotificationToDelete] =
    useState<NotificationItem | null>(null);
  const [deletingNotification, setDeletingNotification] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications]
  );

  const typeOptions = useMemo(
    () => Array.from(new Set(notifications.map((item) => item.type))).sort(),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return notifications.filter((item) => {
      if (statusFilter === "unread" && item.read_at) return false;
      if (statusFilter === "read" && !item.read_at) return false;
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (!normalizedQuery) return true;

      return [item.title, item.message, item.type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [notifications, query, statusFilter, typeFilter]);

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

  useDebouncedRealtimeEvent(
    () => loadNotifications(false),
    [loadNotifications],
    350,
    (message) =>
      message.type === "notification.created" ||
      message.type === "notification.read" ||
      message.type === "notification.read_all" ||
      message.type === "notification.deleted"
  );

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

  const handleDeleteNotification = async () => {
    if (!notificationToDelete) return;

    setDeletingNotification(true);
    try {
      await deleteNotification(notificationToDelete.id);
      setNotifications((current) =>
        current.filter((item) => item.id !== notificationToDelete.id)
      );
      setNotificationToDelete(null);
      toast.success("Notification deleted.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not delete notification."));
    } finally {
      setDeletingNotification(false);
    }
  };

  if (loading) {
    return <WorkspaceLoadingSkeleton metricCount={3} panelCount={1} tableRows={5} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sdlc-page min-w-0 space-y-5">
        <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-xl shadow-black/20">
          <div className="flex flex-col justify-between gap-5 border-b border-slate-800 px-5 py-5 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-200">
                <Bell className="h-3.5 w-3.5" />
                Notification center
              </div>
              <h1 className="break-words text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Your workspace signals
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Assignments, mentions, due-date reminders, AI risk alerts and calendar updates in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-900"
                onClick={() => loadNotifications()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>

              <Button
                className="bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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

          <div className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <Bell className="mb-3 h-5 w-5 text-blue-300" />
              <p className="text-sm text-slate-500">Total</p>
              <p className="mt-1 text-2xl font-semibold text-white">{notifications.length}</p>
            </div>
            <div className="rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4">
              <Inbox className="mb-3 h-5 w-5 text-blue-200" />
              <p className="text-sm text-blue-200/70">Unread</p>
              <p className="mt-1 text-2xl font-semibold text-blue-100">{unreadCount}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="mb-3 h-5 w-5 text-emerald-200" />
              <p className="text-sm text-emerald-200/70">Handled</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-100">
                {notifications.length - unreadCount}
              </p>
            </div>
          </div>
        </section>

        <Card className="overflow-hidden border-slate-800 bg-slate-900/80 text-slate-50">
          <CardContent className="p-0">
            <div className="border-b border-slate-800 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                    <Filter className="h-5 w-5 text-blue-300" />
                    Notification stream
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredNotifications.length} shown out of {notifications.length}.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:w-[44rem]">
                  <div className="relative sm:col-span-3 lg:col-span-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search notifications..."
                      className="h-10 border-slate-700 bg-slate-950 pl-9"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 border-slate-700 bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="unread">Unread only</SelectItem>
                      <SelectItem value="read">Read only</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 border-slate-700 bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-slate-800 bg-slate-950 text-slate-200">
                      <SelectItem value="all">All types</SelectItem>
                      {typeOptions.map((type) => (
                        <SelectItem key={type} value={type}>
                          {notificationLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="divide-y divide-slate-800">
              {filteredNotifications.map((item) => {
                const Icon = notificationIcon(item.type);
                return (
                  <article
                    key={item.id}
                    className={cn(
                      "group flex flex-col gap-4 bg-slate-900/45 p-4 transition hover:bg-slate-900 md:flex-row md:items-start md:justify-between",
                      !item.read_at && "bg-blue-500/[0.06]"
                    )}
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${notificationTone(item.type)}`}>
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={notificationTone(item.type)}>
                            {notificationLabel(item.type)}
                          </Badge>
                          {!item.read_at && (
                            <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                              New
                            </Badge>
                          )}
                          <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span>
                        </div>
                        <h2 className="break-words font-semibold text-white">
                          {item.title}
                        </h2>
                        {item.message && (
                          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                            {item.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">
                      {item.link_url ? (
                        <Button
                          asChild
                          variant="outline"
                          className="h-9 border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-500/40 hover:bg-slate-900 hover:text-blue-200"
                        >
                          <Link href={item.link_url} onClick={() => handleOpen(item)}>
                            Open
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={Boolean(item.read_at)}
                          onClick={() => handleOpen(item)}
                          className="h-9 border-slate-700 bg-slate-950 text-slate-300 hover:border-blue-500/40 hover:bg-slate-900 hover:text-blue-200 disabled:opacity-50"
                        >
                          Mark read
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setNotificationToDelete(item)}
                        className="h-9 w-9 border-rose-500/20 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15 hover:text-rose-100"
                        aria-label={`Delete notification ${item.title}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </article>
                );
              })}

              {filteredNotifications.length === 0 && (
                <div className="px-5 py-12 text-center">
                  <Bell className="mx-auto mb-4 h-10 w-10 text-slate-700" />
                  <h2 className="text-lg font-semibold text-white">
                    {notifications.length === 0
                      ? "No notifications yet"
                      : "No notifications match these filters"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {notifications.length === 0
                      ? "Assignments, mentions and calendar invitations will appear here."
                      : "Clear the search or switch to all notifications."}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={Boolean(notificationToDelete)}
        onOpenChange={(open) => {
          if (!open) setNotificationToDelete(null);
        }}
        title="Delete notification?"
        description={
          notificationToDelete
            ? `This will remove "${notificationToDelete.title}" from your notification center.`
            : "This notification will be removed from your notification center."
        }
        confirmLabel="Delete"
        destructive
        loading={deletingNotification}
        onConfirm={handleDeleteNotification}
      />
    </div>
  );
}
