"use client";

import { MessageSquare, MoreHorizontal, Pencil, Save, Trash2, X } from "lucide-react";

import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { TaskComment } from "@/services/task";
import { TypingUser, formatTaskDate } from "./task-detail-utils";

type TaskCommentsCardProps = {
  comments: TaskComment[];
  currentUserId?: number;
  canComment: boolean;
  typingUsers: TypingUser[];
  newComment: string;
  editingCommentId: number | null;
  editingCommentBody: string;
  onDraftChange: (value: string) => void;
  onStopTyping: () => void;
  onAddComment: () => void;
  onStartEditComment: (commentId: number, body: string) => void;
  onEditingCommentBodyChange: (value: string) => void;
  onCancelCommentEdit: () => void;
  onSaveCommentEdit: () => void;
  onRequestDeleteComment: (commentId: number) => void;
};

export function TaskCommentsCard({
  comments,
  currentUserId,
  canComment,
  typingUsers,
  newComment,
  editingCommentId,
  editingCommentBody,
  onDraftChange,
  onStopTyping,
  onAddComment,
  onStartEditComment,
  onEditingCommentBodyChange,
  onCancelCommentEdit,
  onSaveCommentEdit,
  onRequestDeleteComment,
}: TaskCommentsCardProps) {
  return (
    <Card className="border-slate-800 bg-slate-900/75 text-slate-50 shadow-xl shadow-slate-950/20">
      <CardHeader className="border-b border-slate-800/80">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-cyan-300" />
          Comments
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/75 p-4">
              <div className="mb-3 flex items-start gap-3">
                <UserAvatar
                  name={comment.author_name}
                  src={comment.author_avatar_url}
                  className="h-9 w-9"
                  fallbackClassName="bg-blue-500/10 text-[10px] text-blue-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {comment.author_name || "Unknown user"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {formatTaskDate(comment.created_at)}
                    {comment.updated_at && comment.updated_at !== comment.created_at ? " · edited" : ""}
                  </p>
                </div>
                {currentUserId === comment.author_id && canComment && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:bg-slate-900 hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="border-slate-800 bg-slate-950 text-slate-200">
                      <DropdownMenuItem className="cursor-pointer hover:bg-slate-900" onClick={() => onStartEditComment(comment.id, comment.body)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" className="cursor-pointer" onClick={() => onRequestDeleteComment(comment.id)}>
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>

              {editingCommentId === comment.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editingCommentBody}
                    onChange={(event) => onEditingCommentBodyChange(event.target.value)}
                    disabled={!canComment}
                    className="min-h-24 border-slate-700 bg-slate-900"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={onCancelCommentEdit}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={onSaveCommentEdit} disabled={!canComment}>
                      <Save className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">
                  {comment.body}
                </p>
              )}
            </div>
          ))}

          {typingUsers.length > 0 && (
            <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              <div className="flex -space-x-2">
                {typingUsers.slice(0, 3).map((user) => (
                  <UserAvatar
                    key={user.user_id}
                    name={user.full_name}
                    src={user.avatar_url}
                    className="h-7 w-7 border border-slate-950"
                    fallbackClassName="bg-cyan-500/10 text-[10px] text-cyan-100"
                  />
                ))}
              </div>
              <span>
                {typingUsers.length === 1
                  ? `${typingUsers[0].full_name || "A teammate"} is typing...`
                  : `${typingUsers.length} teammates are typing...`}
              </span>
            </div>
          )}

          {comments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-400">No comments yet</p>
              <p className="mt-1 text-xs text-slate-600">Start the discussion on this issue.</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Textarea
            value={newComment}
            onChange={(event) => onDraftChange(event.target.value)}
            onBlur={onStopTyping}
            placeholder="Add a comment..."
            disabled={!canComment}
            className="min-h-28 border-slate-700 bg-slate-950"
          />
          <Button onClick={onAddComment} disabled={!canComment} className="w-full bg-blue-600 hover:bg-blue-700">
            Add comment
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
