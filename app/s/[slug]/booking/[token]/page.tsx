import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, UserRoundPlus, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { StatusBadge } from "@/components/status-badge";
import { AddToCalendar, CancelBooking, RescheduleButton } from "@/components/booking/booking-actions";
import { ReviewForm } from "@/components/booking/review-form";
import { createClient } from "@/lib/supabase/server";
import { formatDuration, formatInTz } from "@/lib/datetime";
import { formatPhone, formatServiceDuration, formatServicePrice, telHref } from "@/lib/format";
import { copyFor } from "@/lib/vertical";
import { RememberBooking } from "@/components/booking/remember-booking";
import { googleCalendarUrl } from "@/lib/booking/calendar";
import { routeLink } from "@/lib/links";
import type { BookingDetails } from "@/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ваша запись", robots: { index: false, follow: false } };

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; token: string }>;
  searchParams: Promise<{ new?: string; rescheduled?: string }>;
}) {
  const { slug, token } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();

  const supabase = await createClient();
  const [{ data }, { data: auth }] = await Promise.all([
    supabase.rpc("get_booking_by_token", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const b = data as BookingDetails | null;
  if (!b || b.studio.slug !== slug) notFound();

  const tz = b.studio.timezone;
  const active = b.status === "pending" || b.status === "confirmed";
  const headline =
    b.status === "confirmed"
      ? sp.rescheduled ? "Запись перенесена" : "Запись подтверждена"
      : b.status === "pending"
        ? sp.rescheduled ? "Запись перенесена" : "Запись создана"
        : b.status === "cancelled"
          ? "Запись отменена"
          : b.status === "completed"
            ? "Спасибо за визит"
            : "Визит пропущен";
  const sub =
    b.status === "pending"
      ? "Студия подтвердит запись в ближайшее время. Статус обновится на этой странице."
      : b.status === "confirmed"
        ? "Ждём вас. Ссылка на эту страницу поможет перенести или отменить визит."
        : b.status === "completed"
          ? "Будем рады, если вы оставите отзыв."
          : b.status === "cancelled"
            ? "Время освободилось. Можно выбрать другое."
            : "Если хотите прийти снова, запишитесь на новое время.";

  const Icon = b.status === "cancelled" || b.status === "no_show" ? XCircle : b.status === "pending" ? Clock : Check;
  const copy = copyFor(b.studio.vertical);
  const multiDay = Boolean(b.service.duration_days);
  const hm = (iso: string) => formatInTz(iso, tz, { hour: "2-digit", minute: "2-digit" });
  const dm = (iso: string) => formatInTz(iso, tz, { day: "numeric", month: "long" });
  const rows: [string, React.ReactNode][] = [
    ["Студия", b.studio.name],
    ["Услуга", `${b.service.name} · ${formatServiceDuration(b.service)}`],
    [copy.resource, b.staff.name],
    ["Дата", <span key="d" className="capitalize">{formatInTz(b.start_at, tz, { weekday: "long", day: "numeric", month: "long" })}</span>],
    multiDay
      ? ["Время", `заезд ${hm(b.start_at)}, готово ${dm(b.end_at)} к ${hm(b.end_at)}`]
      : ["Время", `${hm(b.start_at)}–${hm(b.end_at)}`],
    ["Стоимость", formatServicePrice(b.price, b.studio.currency, b.service.price_from)],
  ];
  if (b.vehicle_model) rows.push(["Автомобиль", [b.vehicle_model, b.vehicle_plate].filter(Boolean).join(" · ")]);
  if (b.studio.address) {
    rows.push([
      "Адрес",
      <a key="a" href={routeLink(b.studio)} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
        {b.studio.address}
      </a>,
    ]);
  }

  return (
    <main className="mx-auto max-w-2xl px-5 pb-20 pt-6 md:pt-12">
      <RememberBooking slug={slug} token={b.token} />
      <Link href={`/s/${slug}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {b.studio.name}
      </Link>

      <div className="mt-10 animate-fade-up">
        <span
          className={`grid size-14 place-items-center rounded-full ${active || b.status === "completed" ? "bg-primary text-primary-foreground" : "bg-surface-2 text-muted-foreground"}`}
        >
          <Icon className="size-6" aria-hidden />
        </span>
        <h1 className="mt-6 text-4xl font-medium md:text-5xl">{headline}</h1>
        <p className="mt-3 max-w-md text-muted-foreground">{sub}</p>
      </div>

      <section className="mt-10 rounded-[1.5rem] border border-border p-5 animate-fade-up [animation-delay:80ms] md:p-7">
        <div className="flex items-center gap-4">
          <span className="relative size-14 shrink-0 overflow-hidden rounded-full">
            <SmartImage src={b.staff.photo_url} alt="" fallbackLabel={b.staff.name} fill sizes="56px" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{b.staff.name}</p>
            <p className="text-sm text-muted-foreground">{b.staff.position}</p>
          </div>
          <StatusBadge status={b.status} short />
        </div>
        <dl className="mt-6 grid gap-4 border-t border-border pt-6 text-[0.9375rem]">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-4">
              <dt className="text-subtle">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      {active && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <AddToCalendar icsUrl={`/api/booking/${b.token}/ics`} googleUrl={googleCalendarUrl(b)} />
          {b.can_reschedule && <RescheduleButton href={`/s/${slug}/book?reschedule=${b.token}`} />}
        </div>
      )}
      {active && (
        <div className="mt-3">
          {b.can_cancel ? (
            <CancelBooking token={b.token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Отменить или перенести онлайн можно не позднее чем за {formatDuration(b.cancel_notice_minutes)} до визита.
              {b.studio.phone && (
                <>
                  {" "}Позвоните:{" "}
                  <a href={telHref(b.studio.phone)} className="text-foreground underline underline-offset-4">
                    {formatPhone(b.studio.phone)}
                  </a>
                </>
              )}
            </p>
          )}
        </div>
      )}

      {b.can_review && (
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="text-2xl font-medium">Оставить отзыв</h2>
          <div className="mt-6">
            <ReviewForm token={b.token} defaultName={b.client_name.split(" ")[0] ?? ""} />
          </div>
        </section>
      )}
      {b.has_review && b.status === "completed" && (
        <p className="mt-10 text-sm text-muted-foreground">Спасибо, ваш отзыв получен.</p>
      )}

      {!b.has_account && !auth.user && (
        <section className="mt-12 flex flex-col gap-4 rounded-[1.5rem] bg-surface p-6 sm:flex-row sm:items-center">
          <UserRoundPlus className="size-6 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex-1">
            <p className="font-medium">Сохраните запись в аккаунте</p>
            <p className="text-sm text-muted-foreground">Все визиты в одном месте и повторная запись в пару касаний.</p>
          </div>
          <Button asChild variant="secondary">
            <Link
              href={`/login?next=/account&${b.client_email ? `email=${encodeURIComponent(b.client_email)}` : `phone=${encodeURIComponent(b.client_phone)}`}`}
            >
              Сохранить
            </Link>
          </Button>
        </section>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild variant={active ? "ghost" : "default"} size="lg">
          <Link href={b.status === "cancelled" || b.status === "no_show" ? `/s/${slug}/book?service=${b.service.id}` : `/s/${slug}`}>
            {b.status === "cancelled" || b.status === "no_show" ? "Записаться снова" : "Вернуться в студию"}
          </Link>
        </Button>
        {!active && (
          <Button asChild variant="ghost" size="lg">
            <Link href={`/s/${slug}`}>Вернуться в студию</Link>
          </Button>
        )}
      </div>
      {sp.new && <p className="sr-only" role="status">Запись создана</p>}
    </main>
  );
}
