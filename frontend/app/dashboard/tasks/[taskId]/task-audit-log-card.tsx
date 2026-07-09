import { History } from "lucide-react";

import { AuditLogEvent } from "@/components/dashboard/audit-log-event";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskAuditLog } from "@/services/task";

export function TaskAuditLogCard({ logs }: { logs: TaskAuditLog[] }) {
  return (
    <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="border-b border-slate-800/80">
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-violet-300" />
          Audit Log
        </CardTitle>
        <p className="text-sm text-slate-500">
          Immutable activity trail for this issue.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-5">
        {[...logs].reverse().map((log) => (
          <AuditLogEvent key={log.id} event={log} />
        ))}

        {logs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
            <p className="text-sm font-medium text-slate-400">
              No audit events yet
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Changes will appear here as the issue evolves.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
