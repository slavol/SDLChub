"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LifeBuoy,
  MessageSquare,
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  createSupportTicket,
  createSupportTicketComment,
  deleteSupportTicket,
  deleteSupportTicketComment,
  getMySupportTickets,
  getSupportTicket,
  SupportTicket,
} from "@/services/admin";
import { useAuthStore } from "@/store/use-auth-store";

const priorities = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const statusSteps = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

const statusLabels: Record<string, string> = {
  OPEN: "Received",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

const statusTone: Record<string, string> = {
  OPEN: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  IN_PROGRESS: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  RESOLVED: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  CLOSED: "border-slate-600 bg-slate-800 text-slate-300",
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getProgress(status: string) {
  const index = Math.max(0, statusSteps.indexOf(status));
  return Math.round(((index + 1) / statusSteps.length) * 100);
}

export default function SupportPage() {
  const user = useAuthStore((state) => state.user);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(
    null
  );
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingComment, setSendingComment] = useState(false);

  const openTickets = useMemo(
    () =>
      tickets.filter((ticket) =>
        ["OPEN", "IN_PROGRESS"].includes(ticket.status)
      ).length,
    [tickets]
  );

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await getMySupportTickets();
      setTickets(data);
      if (data.length > 0) {
        const active =
          selectedTicket &&
          data.find((ticket) => ticket.id === selectedTicket.id);
        setSelectedTicket(active || data[0]);
      }
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Could not load support tickets."));
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshSelectedTicket = async (ticketId: number) => {
    const updated = await getSupportTicket(ticketId);
    setSelectedTicket(updated);
    setTickets((current) =>
      current.map((ticket) => (ticket.id === updated.id ? updated : ticket))
    );
    return updated;
  };

  const handleSubmit = async () => {
    if (title.trim().length < 3) {
      toast.error("Add a clear title for the support ticket.");
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSupportTicket({
        title: title.trim(),
        description: description.trim(),
        priority,
      });
      setTickets((current) => [created, ...current]);
      setSelectedTicket(created);
      setTitle("");
      setDescription("");
      setPriority("MEDIUM");
      toast.success("Ticket created. You can follow it here.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Support ticket could not be sent."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendComment = async () => {
    if (!selectedTicket || comment.trim().length === 0) return;

    setSendingComment(true);
    try {
      await createSupportTicketComment(selectedTicket.id, comment.trim());
      setComment("");
      await refreshSelectedTicket(selectedTicket.id);
      toast.success("Comment added.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Comment could not be sent."));
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteSelectedTicket = async () => {
    if (!selectedTicket) return;

    try {
      await deleteSupportTicket(selectedTicket.id);
      setTickets((current) => {
        const remaining = current.filter((ticket) => ticket.id !== selectedTicket.id);
        setSelectedTicket(remaining[0] || null);
        return remaining;
      });
      toast.success("Ticket deleted.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Ticket could not be deleted."));
    }
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedTicket) return;

    try {
      await deleteSupportTicketComment(selectedTicket.id, commentId);
      await refreshSelectedTicket(selectedTicket.id);
      toast.success("Comment deleted.");
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Comment could not be deleted."));
    }
  };

  const selectedComments = selectedTicket?.comments || [];

  return (
    <div className="mx-auto max-w-7xl space-y-7 p-6 text-slate-50 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-blue-500/10 text-blue-200">
                <LifeBuoy className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.22em] text-blue-300">
                  Support Desk
                </p>
                <h1 className="text-3xl font-semibold tracking-tight text-white">
                  Track application tickets
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Creeaza tichete, urmareste progresul si discuta direct cu
                  Global Admin.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-72">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-sm text-slate-500">My tickets</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {tickets.length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <p className="text-sm text-slate-500">Open</p>
                <p className="mt-1 text-2xl font-semibold text-white">
                  {openTickets}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    New ticket
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Describe the issue clearly for faster triage.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="support-title" className="text-slate-300">
                    Title
                  </Label>
                  <Input
                    id="support-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Example: Board does not update after moving a task"
                    className="h-11 rounded-xl border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                  />
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="support-description"
                    className="text-slate-300"
                  >
                    Description
                  </Label>
                  <Textarea
                    id="support-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What happened, what you expected, and where it happened."
                    className="min-h-32 rounded-xl border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {priorities.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setPriority(item.value)}
                      className={
                        priority === item.value
                          ? "rounded-xl border border-blue-500/40 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-white"
                          : "rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm font-medium text-slate-400 transition hover:border-slate-700 hover:text-white"
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Create ticket
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70">
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 p-5">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    My tickets
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Select one to see progress and comments.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
                  onClick={loadTickets}
                  disabled={loadingTickets}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <div className="max-h-[520px] space-y-2 overflow-y-auto p-3">
                {tickets.map((ticket) => {
                  const selected = selectedTicket?.id === ticket.id;
                  return (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicket(ticket)}
                      className={
                        selected
                          ? "w-full rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 text-left"
                          : "w-full rounded-2xl border border-slate-800 bg-slate-900/50 p-4 text-left transition hover:border-slate-700 hover:bg-slate-900"
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {ticket.title}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            #{ticket.id} · {formatDate(ticket.created_at)}
                          </p>
                        </div>
                        <Badge
                          className={
                            statusTone[ticket.status] ||
                            "border-slate-700 bg-slate-900 text-slate-300"
                          }
                        >
                          {statusLabels[ticket.status] || ticket.status}
                        </Badge>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${getProgress(ticket.status)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}

                {!loadingTickets && tickets.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-sm text-slate-500">
                    No support tickets yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-950/70">
            {selectedTicket ? (
              <>
                <div className="border-b border-slate-800 p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge className="border-slate-700 bg-slate-900 text-slate-300">
                          #{selectedTicket.id}
                        </Badge>
                        <Badge
                          className={
                            statusTone[selectedTicket.status] ||
                            "border-slate-700 bg-slate-900 text-slate-300"
                          }
                        >
                          {statusLabels[selectedTicket.status] ||
                            selectedTicket.status}
                        </Badge>
                        <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-200">
                          {selectedTicket.priority}
                        </Badge>
                      </div>
                      <h2 className="text-2xl font-semibold text-white">
                        {selectedTicket.title}
                      </h2>
                      <p className="mt-2 text-sm text-slate-500">
                        Created {formatDate(selectedTicket.created_at)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-fit rounded-xl border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20 hover:text-white"
                      onClick={handleDeleteSelectedTicket}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete ticket
                    </Button>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-4">
                    {statusSteps.map((step, index) => {
                      const currentIndex = statusSteps.indexOf(
                        selectedTicket.status
                      );
                      const complete = index <= currentIndex;
                      return (
                        <div
                          key={step}
                          className={
                            complete
                              ? "rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3"
                              : "rounded-2xl border border-slate-800 bg-slate-900/40 p-3"
                          }
                        >
                          <div className="flex items-center gap-2">
                            {complete ? (
                              <CheckCircle2 className="h-4 w-4 text-blue-300" />
                            ) : (
                              <Clock3 className="h-4 w-4 text-slate-600" />
                            )}
                            <p
                              className={
                                complete
                                  ? "text-sm font-semibold text-white"
                                  : "text-sm font-medium text-slate-500"
                              }
                            >
                              {statusLabels[step]}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-5 p-5">
                  {selectedTicket.description && (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                        Original report
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {selectedTicket.description}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-300" />
                      <h3 className="text-sm font-semibold text-white">
                        Conversation
                      </h3>
                    </div>

                    <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
                      {selectedComments.map((item) => (
                        <div
                          key={item.id}
                          className={
                            item.is_admin_note
                              ? "rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4"
                              : "rounded-2xl border border-slate-800 bg-slate-900/50 p-4"
                          }
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">
                              {item.author_name ||
                                item.author_email ||
                                (item.author_id === user?.id ? "You" : "User")}
                            </p>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-slate-500">
                                {formatDate(item.created_at)}
                              </p>
                              {item.author_id === user?.id && (
                                <button
                                  type="button"
                                  className="rounded-md p-1 text-slate-600 transition hover:bg-red-500/10 hover:text-red-300"
                                  onClick={() => handleDeleteComment(item.id)}
                                  title="Delete comment"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                            {item.body}
                          </p>
                        </div>
                      ))}

                      {selectedComments.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">
                          No comments yet. Add context for the admin team.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
                    <Label htmlFor="support-comment" className="text-slate-300">
                      Add comment
                    </Label>
                    <Textarea
                      id="support-comment"
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add reproduction steps, screenshots notes, or confirm the fix..."
                      className="min-h-28 rounded-xl border-slate-800 bg-slate-950 text-slate-100 placeholder:text-slate-600"
                    />
                    <Button
                      onClick={handleSendComment}
                      disabled={sendingComment || comment.trim().length === 0}
                      className="h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Send comment
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex min-h-[560px] items-center justify-center p-8 text-center">
                <div>
                  <LifeBuoy className="mx-auto h-10 w-10 text-slate-600" />
                  <h2 className="mt-4 text-lg font-semibold text-white">
                    Select or create a ticket
                  </h2>
                  <p className="mt-2 max-w-sm text-sm text-slate-500">
                    Once a ticket is created, its status and conversation will
                    appear here.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
