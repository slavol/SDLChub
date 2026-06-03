"use client";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/75",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
