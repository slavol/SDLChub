"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type WorkspaceLoadingSkeletonProps = {
  metricCount?: number;
  panelCount?: number;
  tableRows?: number;
  withHeaderActions?: boolean;
  withSidePanel?: boolean;
  className?: string;
};

export function WorkspaceLoadingSkeleton({
  metricCount = 4,
  panelCount = 2,
  tableRows = 0,
  withHeaderActions = true,
  withSidePanel = false,
  className,
}: WorkspaceLoadingSkeletonProps) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl space-y-7 px-4 py-5 text-slate-50 sm:px-6 md:p-8", className)}>
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="border-b border-slate-800 bg-slate-950/45 px-6 py-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-3">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-11 w-80 max-w-full" />
              <Skeleton className="h-5 w-[34rem] max-w-full" />
            </div>
            {withHeaderActions && (
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-10 w-28 rounded-xl" />
                <Skeleton className="h-10 w-36 rounded-xl" />
              </div>
            )}
          </div>
        </div>
      </section>

      {metricCount > 0 && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: metricCount }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </section>
      )}

      <section className={cn("grid min-w-0 gap-6", withSidePanel && "xl:grid-cols-[minmax(0,1fr)_24rem]")}>
        <div className="min-w-0 space-y-6">
          {Array.from({ length: panelCount }).map((_, index) => (
            <div key={index} className="rounded-3xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 p-5">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-2">
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            </div>
          ))}

          {tableRows > 0 && (
            <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80">
              <div className="border-b border-slate-800 p-5">
                <Skeleton className="h-7 w-40" />
                <Skeleton className="mt-2 h-4 w-56 max-w-full" />
              </div>
              <div className="divide-y divide-slate-800">
                {Array.from({ length: tableRows }).map((_, index) => (
                  <div key={index} className="grid gap-4 p-5 lg:grid-cols-[1fr_10rem_10rem_2rem]">
                    <div className="space-y-2">
                      <Skeleton className="h-5 w-64 max-w-full" />
                      <Skeleton className="h-4 w-40 max-w-full" />
                    </div>
                    <Skeleton className="h-10 rounded-xl" />
                    <Skeleton className="h-10 rounded-xl" />
                    <Skeleton className="h-10 rounded-xl" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {withSidePanel && (
          <aside className="min-w-0 space-y-4">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="mt-2 h-4 w-56 max-w-full" />
              <div className="mt-5 space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 rounded-2xl" />
                ))}
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}

export function BoardLoadingSkeleton() {
  return (
    <div className="flex h-full min-w-0 gap-4 xl:w-full xl:gap-5">
      {Array.from({ length: 4 }).map((_, columnIndex) => (
        <div
          key={columnIndex}
          className="flex h-full w-[80vw] min-w-[15rem] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 sm:w-[20rem] xl:min-w-0 xl:flex-1"
        >
          <div className="border-b border-slate-800 p-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          </div>
          <div className="space-y-3 overflow-hidden p-3">
            {Array.from({ length: 5 }).map((_, cardIndex) => (
              <Skeleton key={cardIndex} className="h-36 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
