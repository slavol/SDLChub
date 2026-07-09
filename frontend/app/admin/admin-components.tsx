import type { LucideIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

export function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "emerald" | "amber" | "red" | "violet";
}) {
  const tones = {
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-200",
    emerald: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    red: "border-red-500/25 bg-red-500/10 text-red-200",
    violet: "border-violet-500/25 bg-violet-500/10 text-violet-200",
  };

  return (
    <div className="group rounded-2xl border border-slate-800 bg-slate-950/75 p-4 shadow-xl shadow-slate-950/20 transition hover:border-slate-700 hover:bg-slate-950">
      <div className="flex items-center justify-between gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl border ${tones[tone]}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-white">
          {value}
        </p>
      </div>
      <div className="mt-3">
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="mt-1 text-sm leading-5 text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

export function AdminConsoleSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1560px] space-y-6 p-4 text-slate-100 sm:p-5 xl:p-7">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/75 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 border-b border-slate-800 bg-slate-900/35 p-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Skeleton className="h-14 w-14 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-3">
              <Skeleton className="h-4 w-48 rounded-full" />
              <Skeleton className="h-10 w-80 max-w-full" />
              <Skeleton className="h-5 w-[34rem] max-w-full" />
            </div>
          </div>
          <div className="w-full space-y-3 xl:w-[560px]">
            <Skeleton className="h-12 rounded-2xl" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-11 rounded-xl" />
              <Skeleton className="h-11 rounded-xl" />
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </section>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Skeleton className="h-60 rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {Array.from({ length: 2 }).map((_, panelIndex) => (
          <div key={panelIndex} className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70">
            <div className="border-b border-slate-800 p-5">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="mt-2 h-4 w-64 max-w-full" />
            </div>
            <div className="divide-y divide-slate-800">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-4 p-5 lg:grid-cols-[1fr_10rem_10rem]">
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-64 max-w-full" />
                    <Skeleton className="h-4 w-40 max-w-full" />
                  </div>
                  <Skeleton className="h-10 rounded-xl" />
                  <Skeleton className="h-10 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
