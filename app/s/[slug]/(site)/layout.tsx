import { notFound } from "next/navigation";
import { getStudio } from "@/lib/data/studio";
import { StudioHeader } from "@/components/studio/studio-header";
import { StudioMobileNav } from "@/components/studio/mobile-nav";
import Link from "next/link";
import { BRAND } from "@/lib/config";
import { telHref } from "@/lib/format";
import { copyFor } from "@/lib/vertical";

export const revalidate = 60;

export default async function StudioSiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const studio = await getStudio(slug);
  if (!studio) notFound();

  return (
    <div className="min-h-dvh pb-32 md:pb-0">
      <StudioHeader studio={studio} />
      {children}
      <footer className="mx-auto mt-10 grid max-w-6xl gap-6 border-t border-border px-5 py-8 text-[0.9375rem] text-muted-foreground md:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href={`/s/${studio.slug}`} className="hover:text-foreground">{studio.name}</Link>
          {studio.phone ? (
            <a href={telHref(studio.phone)} className="inline-flex items-center gap-1.5 hover:text-foreground">Связаться ↗</a>
          ) : studio.email ? (
            <a href={`mailto:${studio.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground">Написать ↗</a>
          ) : null}
        </div>
        <nav aria-label="Разделы" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href={`/s/${studio.slug}/services`} className="hover:text-foreground">Услуги и цены</Link>
          <Link href={`/s/${studio.slug}/staff`} className="hover:text-foreground">{copyFor(studio.vertical).resourcePlural}</Link>
          <Link href={`/s/${studio.slug}/reviews`} className="hover:text-foreground">Отзывы</Link>
          <Link href={`/s/${studio.slug}/my`} className="hover:text-foreground">Моя запись</Link>
          <Link href="/privacy" className="hover:text-foreground">Политика данных</Link>
        </nav>
        <span className="text-xs text-subtle">Онлайн-запись на {BRAND.name}</span>
      </footer>
      <StudioMobileNav slug={studio.slug} />
    </div>
  );
}
