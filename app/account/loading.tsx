import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-4" aria-busy="true">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-32 w-full rounded-[1.25rem]" />
      <Skeleton className="h-32 w-full rounded-[1.25rem]" />
    </div>
  );
}
