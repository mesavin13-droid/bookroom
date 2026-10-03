import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, Clock3, MapPin, Phone, Tag, Users, Warehouse, Wrench } from "lucide-react";
import { SmartImage } from "@/components/smart-image";
import { GlowPanel } from "@/components/studio/glow-panel";
import { ServicesList } from "@/components/studio/services-list";
import { StaffGrid } from "@/components/studio/staff-grid";
import { ReviewsList } from "@/components/studio/reviews-list";
import { InstallCard } from "@/components/studio/install-app";
import { Gallery } from "@/components/studio/gallery";
import { getStudioPageData } from "@/lib/data/studio";
import { getNextAvailableSlot } from "@/lib/data/next-slot";
import { WEEKDAY_LONG, addDaysKey, formatDateKey, isoWeekday, todayKey } from "@/lib/datetime";
import { formatPrice, telHref } from "@/lib/format";
import { routeLink } from "@/lib/links";
import { copyFor } from "@/lib/vertical";
import { plural } from "@/lib/utils";

export const revalidate = 60;

function Heading({ children, href, label }: { children: React.ReactNode; href?: string; label?: string }) {
  return (
    <div className="mb-4 mt-12 flex items-baseline justify-between gap-4 md:mb-6 md:mt-20">
      <h2 className="text-[2rem] font-semibold md:text-5xl">{children}</h2>
      {href && (
        <Link href={href} className="flex shrink-0 items-center gap-1.5 text-[0.9375rem] text-muted-foreground hover:text-foreground">
          {label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

export default async function StudioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStudioPageData(slug);
  if (!data) notFound();
  const { studio, services, staff, categories, reviews, rating, hours, gallery } = data;
  const copy = copyFor(studio.vertical);
  const next = await getNextAvailableSlot(studio, services);
  const today = todayKey(studio.timezone);
  const todayHours = hours.find((h) => h.weekday === isoWeekday(today));
  const minPrice = services.length ? Math.min(...services.map((s) => s.price)) : null;
  const book = `/s/${studio.slug}/book`;
  const nextLabel = next
    ? `${next.date === today ? "сегодня" : next.date === addDaysKey(today, 1) ? "завтра" : formatDateKey(next.date, { day: "numeric", month: "long" })}, ${next.time}`
    : null;
  const logoMark = (
    <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden>
      <path d="M8 13h20a4 4 0 0 1 0 8H12m-4 6h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );

  return (
    <main className="mx-auto max-w-6xl px-5 pt-5 md:px-8 md:pt-10">
      {/* Hero */}
      <section className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-end md:gap-12">
        <div className="relative aspect-[1/0.82] overflow-hidden rounded-[1.75rem] border border-border bg-surface animate-fade-up md:aspect-[4/3.4]">
          <div className="duotone-wrap absolute inset-0">
            <SmartImage src={studio.cover_url} alt={studio.name} fallbackLabel={studio.name} fill priority sizes="(min-width: 768px) 55vw, 100vw" className="duotone" />
          </div>
          <div aria-hidden className="absolute inset-x-[10%] top-[6%] h-[30%] rounded-[50%] bg-primary opacity-35 blur-[28px]" />
          <Link
            href={book}
            className="absolute inset-x-5 bottom-5 flex h-14 items-center justify-between rounded-full border border-foreground/20 bg-background/50 pl-7 pr-5 font-semibold backdrop-blur-lg transition-colors hover:bg-background/70"
          >
            Записаться <ArrowUpRight className="size-5" />
          </Link>
        </div>

        <div className="animate-fade-up [animation-delay:80ms]">
          <h1 className="text-[2.5rem] font-semibold md:text-7xl">{studio.name}</h1>
          {studio.tagline && <p className="mt-3 max-w-md text-[1.0625rem] leading-snug text-muted-foreground md:text-xl">{studio.tagline}</p>}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Link href={`/s/${studio.slug}/services`} className="rounded-[1.375rem] border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2">
              <span className="flex items-center gap-2.5 text-[1.75rem] font-semibold tabular"><Wrench className="size-5" aria-hidden />{services.length}</span>
              <span className="mt-1 block text-[0.9375rem] text-muted-foreground">{plural(services.length, ["услуга в прайсе", "услуги в прайсе", "услуг в прайсе"])}</span>
            </Link>
            <Link href={`/s/${studio.slug}/staff`} className="rounded-[1.375rem] border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2">
              <span className="flex items-center gap-2.5 text-[1.75rem] font-semibold tabular">{studio.vertical === "auto" ? <Warehouse className="size-5" aria-hidden /> : <Users className="size-5" aria-hidden />}{staff.length}</span>
              <span className="mt-1 block text-[0.9375rem] text-muted-foreground">{copy.statLabel(staff.length)}</span>
            </Link>
            {minPrice !== null && (
              <Link href={`/s/${studio.slug}/services`} className="col-span-2 flex items-center justify-between rounded-[1.375rem] border border-border bg-surface px-5 py-4 transition-colors hover:bg-surface-2">
                <span className="flex items-center gap-2.5 text-[1.75rem] font-semibold tabular"><Tag className="size-5" aria-hidden />от {formatPrice(minPrice, studio.currency)}</span>
                <span className="text-[0.9375rem] text-muted-foreground">за услугу</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Booking + info */}
      <Heading>Запись в студию</Heading>
      <div className="grid gap-3 md:grid-cols-2">
        <GlowPanel className="p-6 md:p-8">
          <h3 className="text-2xl font-semibold md:text-3xl">{copy.bookTitle}</h3>
          <p className="mt-2 text-muted-foreground">Выберите услугу и удобное время, остальное возьмём на себя</p>
          <Link
            href={next ? `${book}?date=${next.date}` : book}
            className="mt-6 flex h-14 items-center justify-center gap-2.5 rounded-full bg-primary font-semibold text-primary-foreground shadow-[0_10px_40px_-10px_oklch(var(--primary)/0.8)] transition-transform active:scale-[0.98]"
          >
            Выбрать время <ArrowUpRight className="size-5" />
          </Link>
          {nextLabel && <p className="mt-4 text-center text-sm text-muted-foreground">Ближайшее окно: <span className="text-foreground">{nextLabel}</span></p>}
        </GlowPanel>

        <div className="grid content-between gap-5 rounded-[1.75rem] border border-border bg-surface p-6 md:p-8">
          {studio.address && (
            <a href={routeLink(studio)} target="_blank" rel="noopener noreferrer" className="flex gap-4 text-[1.0625rem] font-medium underline-offset-4 hover:underline"><MapPin className="mt-0.5 size-[22px] shrink-0 text-muted-foreground" />{studio.address}</a>
          )}
          <details className="group">
            <summary className="flex cursor-pointer list-none gap-4">
              <Clock3 className="mt-0.5 size-[22px] shrink-0 text-muted-foreground" />
              <span>
                <span className="block text-[1.0625rem] font-medium tabular">{todayHours?.open ? `${todayHours.open}–${todayHours.close}` : "Сегодня выходной"}</span>
                <span className="block text-sm text-muted-foreground">сегодня, по времени студии · <span className="underline underline-offset-4">все дни</span></span>
              </span>
            </summary>
            <dl className="mt-4 grid gap-2 pl-[38px] text-[0.9375rem] text-muted-foreground">
              {hours.map((h) => (
                <div key={h.weekday} className="flex justify-between gap-6">
                  <dt>{WEEKDAY_LONG[h.weekday]}</dt>
                  <dd className="tabular">{h.open ? `${h.open}–${h.close}` : "выходной"}</dd>
                </div>
              ))}
            </dl>
          </details>
          <div className="flex gap-2.5">
            {studio.address && (
              <a href={routeLink(studio)} target="_blank" rel="noopener noreferrer" className="inline-flex h-[52px] items-center gap-2.5 rounded-full border border-border px-6 font-semibold transition-colors hover:bg-surface-2">
                Маршрут <ArrowUpRight className="size-[18px]" />
              </a>
            )}
            {studio.phone && (
              <a href={telHref(studio.phone)} aria-label="Позвонить" className="grid size-[52px] place-items-center rounded-full border border-border transition-colors hover:bg-surface-2">
                <Phone className="size-5" />
              </a>
            )}
          </div>
        </div>
      </div>

      <Heading href={`/s/${studio.slug}/services`} label="Все услуги">Услуги</Heading>
      <ServicesList slug={studio.slug} services={services} categories={categories} currency={studio.currency} limit={5} />

      {studio.vertical === "beauty" && staff.length > 0 && (
        <>
          <Heading href={`/s/${studio.slug}/staff`} label="Все">{copy.resourcePlural}</Heading>
          <StaffGrid slug={studio.slug} staff={staff} services={services} />
        </>
      )}

      {gallery.length > 0 && (
        <>
          <Heading>{copy.worksTitle}</Heading>
          <Gallery items={gallery} fallbackAlt={studio.name} />
        </>
      )}

      {reviews.length > 0 && (
        <>
          <Heading href={`/s/${studio.slug}/reviews`} label="Все отзывы">Отзывы</Heading>
          <p className="-mt-2 mb-4 text-muted-foreground tabular">
            {rating.average.toFixed(1)} из 5 · {rating.count} {plural(rating.count, ["отзыв", "отзыва", "отзывов"])}
          </p>
          <ReviewsList reviews={reviews.slice(0, 4)} staff={staff} timezone={studio.timezone} resourceLabel={copy.resource.toLowerCase()} />
        </>
      )}

      <div className="mt-14 md:mt-20">
        <InstallCard name={studio.name} logo={logoMark} />
      </div>
    </main>
  );
}
