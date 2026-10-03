import Link from "next/link";
import { cn } from "@/lib/utils";

export function Section({
  id,
  title,
  eyebrow,
  action,
  className,
  children,
}: {
  id?: string;
  title: string;
  eyebrow?: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn("py-12 md:py-20", className)}>
      <div className="mb-6 flex items-end justify-between gap-4 md:mb-10">
        <div>
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h2 id={id ? `${id}-title` : undefined} className="text-3xl font-medium md:text-5xl">
            {title}
          </h2>
        </div>
        {action && (
          <Link href={action.href} className="shrink-0 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
