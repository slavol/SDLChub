"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, History, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  getCurrentUserSecurityLog,
  getCurrentUserSessions,
  revokeCurrentUserSession,
  UserSecurityLog,
  UserSession,
} from "@/services/auth";

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventTone(type: string) {
  if (type.includes("LOGIN")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (type.includes("PASSWORD")) return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  if (type.includes("REVOKED")) return "border-red-500/30 bg-red-500/10 text-red-200";
  return "border-blue-500/30 bg-blue-500/10 text-blue-200";
}

export function AccountSecurityPanel() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [securityLogs, setSecurityLogs] = useState<UserSecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionToRevoke, setSessionToRevoke] = useState<UserSession | null>(null);
  const [revoking, setRevoking] = useState(false);

  const activeSessions = useMemo(
    () => sessions.filter((session) => !session.revoked_at),
    [sessions]
  );

  const loadSecurity = async () => {
    setLoading(true);
    try {
      const [nextSessions, nextLogs] = await Promise.all([
        getCurrentUserSessions(),
        getCurrentUserSecurityLog(50),
      ]);

      setSessions(nextSessions);
      setSecurityLogs(nextLogs);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load security activity."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecurity();
  }, []);

  const handleRevokeSession = async () => {
    if (!sessionToRevoke) return;

    setRevoking(true);
    try {
      await revokeCurrentUserSession(sessionToRevoke.id);
      toast.success(
        sessionToRevoke.is_current
          ? "Current session revoked. You may need to sign in again."
          : "Session revoked."
      );
      setSessionToRevoke(null);
      await loadSecurity();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not revoke session."));
    } finally {
      setRevoking(false);
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-12">
        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-7">
          <CardHeader className="border-b border-slate-800/80">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              Active sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))
            ) : activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <MonitorSmartphone className="h-4 w-4 text-blue-300" />
                        <p className="font-semibold text-white">
                          {session.device_label || "Unknown device"}
                        </p>
                        {session.is_current && (
                          <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-200">
                            Current
                          </Badge>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        IP: {session.ip_address || "unknown"} · Created {formatDateTime(session.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Last seen {formatDateTime(session.last_seen_at)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20"
                      onClick={() => setSessionToRevoke(session)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">
                No active sessions found.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/80 text-slate-50 shadow-xl shadow-slate-950/20 xl:col-span-5">
          <CardHeader className="border-b border-slate-800/80">
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-violet-300" />
              Security log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-2xl" />
              ))
            ) : securityLogs.length > 0 ? (
              securityLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className={eventTone(log.event_type)}>
                      {log.event_type.replaceAll("_", " ")}
                    </Badge>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDateTime(log.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 font-semibold text-white">{log.title}</p>
                  {log.detail && <p className="mt-1 text-sm text-slate-400">{log.detail}</p>}
                  <p className="mt-2 text-xs text-slate-600">
                    IP: {log.ip_address || "unknown"}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-5 text-sm text-slate-500">
                No security events recorded yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={sessionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) setSessionToRevoke(null);
        }}
        title={sessionToRevoke?.is_current ? "Revoke current session?" : "Revoke this session?"}
        description={
          sessionToRevoke?.is_current
            ? "This marks your current token session as revoked. You may need to sign in again."
            : "This marks the selected token session as revoked."
        }
        confirmLabel="Revoke Session"
        destructive
        loading={revoking}
        onConfirm={handleRevokeSession}
      />
    </>
  );
}
