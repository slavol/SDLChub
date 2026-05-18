"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function getInitials(name?: string | null, email?: string | null) {
  const source = name || email || "User";

  return source
    .split(/[ .@_-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function resolveMediaUrl(value?: string | null) {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
  return `${baseUrl}${value}`;
}

interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  email,
  src,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const avatarSrc = resolveMediaUrl(src);

  return (
    <Avatar className={cn("border border-slate-700 bg-slate-900", className)}>
      {avatarSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarSrc}
          alt={name || email || "User avatar"}
          className="h-full w-full object-cover"
        />
      ) : (
        <AvatarFallback
          className={cn(
            "bg-slate-800 text-xs font-semibold text-slate-200",
            fallbackClassName
          )}
        >
          {getInitials(name, email)}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
