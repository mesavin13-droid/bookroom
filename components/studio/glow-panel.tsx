import { cn } from "@/lib/utils";

/** Card with the animated, shimmering dot-matrix glow. Pure CSS, respects reduced motion. */
export function GlowPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("glow-panel rounded-[1.75rem] border border-border bg-surface", className)}>{children}</div>;
}
