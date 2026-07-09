import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskDetailSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 text-slate-50 sm:px-6 md:p-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/80 shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 border-b border-slate-800 bg-slate-950/45 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <Skeleton className="h-9 w-28 rounded-xl" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            <Skeleton className="h-10 w-[34rem] max-w-full" />
            <Skeleton className="h-5 w-[26rem] max-w-full" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-32 rounded-xl" />
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-slate-800 bg-slate-900/80 text-slate-50">
              <CardHeader className="border-b border-slate-800/80">
                <Skeleton className="h-6 w-44" />
                <Skeleton className="h-4 w-64 max-w-full" />
              </CardHeader>
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-16 rounded-2xl" />
              </CardContent>
            </Card>
          ))}
        </div>

        <aside className="space-y-6">
          <Card className="border-slate-800 bg-slate-900/80 text-slate-50">
            <CardHeader className="border-b border-slate-800/80">
              <Skeleton className="h-6 w-28" />
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 rounded-xl" />
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
