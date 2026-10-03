import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container grid gap-10 py-6 md:grid-cols-2 md:py-12" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="aspect-[4/5] w-full rounded-[1.75rem] md:order-2" />
      <div className="grid content-end gap-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-24 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-12 w-44 rounded-full" />
      </div>
      <div className="grid gap-4 md:col-span-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </div>
  );
}
