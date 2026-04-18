import { Skeleton } from "../../../components/ui/skeleton";

export default function CompanyLoading() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1280px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-36 rounded-full" />
        <Skeleton className="size-9 rounded-full" />
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-gradient-to-br from-card via-card/80 to-primary/10 p-8 sm:p-10">
        <div className="flex gap-6">
          <Skeleton className="size-20 rounded-2xl" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-12 w-2/3 rounded-xl" />
            <Skeleton className="h-5 w-full max-w-xl rounded-full" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-7 w-24 rounded-full" />
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
