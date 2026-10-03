import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {Icon && (
        <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <div className="grid gap-1">
        <p className="text-base font-medium">{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
