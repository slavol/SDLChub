"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-slate-800 bg-slate-950 text-slate-50 sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="text-slate-400 hover:text-white"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            disabled={loading}
            className={
              destructive
                ? "bg-rose-600 hover:bg-rose-700"
                : "bg-blue-600 hover:bg-blue-700"
            }
            onClick={onConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
