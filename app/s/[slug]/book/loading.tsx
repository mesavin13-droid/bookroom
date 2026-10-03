import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container grid gap-6 pt-20" aria-busy="true" aria-label="Загрузка">
      <Skeleton className="h-10 w-64" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-[72px] w-full max-w-2xl rounded-2xl" />
      ))}
    </div>
  );
}
