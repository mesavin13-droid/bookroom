import Link from "next/link";
import { BRAND } from "@/lib/config";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 text-sm font-semibold tracking-[0.18em]", className)}>
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 8h5.2a2.4 2.4 0 0 1 0 4.8H8zm0 4.8h6a2.6 2.6 0 0 1 0 5.2H8z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
      {BRAND.name}
    </Link>
  );
}
