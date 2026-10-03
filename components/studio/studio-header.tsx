import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountLink } from "@/components/studio/account-link";
import { SmartImage } from "@/components/smart-image";
import { copyFor } from "@/lib/vertical";
import type { Studio } from "@/types";

export function StudioLogo({ studio, size = 40 }: { studio: Pick<Studio, "logo_url" | "name">; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-foreground" style={{ width: size, height: size }}>
      {studio.logo_url ? (
        <SmartImage src={studio.logo_url} alt="" fill sizes={`${size}px`} />
      ) : (
        <svg viewBox="0 0 40 40" width={size * 0.62} height={size * 0.62} aria-hidden>
          <path d="M8 13h20a4 4 0 0 1 0 8H12m-4 6h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}

export function StudioHeader({ studio }: { studio: Studio }) {
  const base = `/s/${studio.slug}`;
  const copy = copyFor(studio.vertical);
  return (
    <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 border-b border-border px-5 md:h-[72px] md:px-8">
        <Link href={base} className="flex min-w-0 items-center gap-3">
          <StudioLogo studio={studio} />
          <span className="truncate text-[0.9375rem] font-bold tracking-[0.04em]">{studio.name}</span>
        </Link>
        <nav aria-label="Разделы студии" className="hidden items-center gap-1 md:flex">
          {[
            ["Услуги", `${base}/services`],
            [copy.resourcePlural, `${base}/staff`],
            ["Отзывы", `${base}/reviews`],
            ["Моя запись", `${base}/my`],
          ].map(([label, href]) => (
            <Button key={href} asChild variant="ghost" size="sm">
              <Link href={href!}>{label}</Link>
            </Button>
          ))}
          <Button asChild size="sm" className="ml-2">
            <Link href={`${base}/book`}>Записаться</Link>
          </Button>
          <span className="ml-1">
            <AccountLink />
          </span>
        </nav>
        <div className="md:hidden">
          <AccountLink />
        </div>
      </div>
    </header>
  );
}
