import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden rounded-xl bg-surface", className)}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-[linear-gradient(90deg,transparent,oklch(var(--surface-3)/0.6),transparent)]" />
    </div>
  );
}
