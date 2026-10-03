"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { getBookingsByTokens } from "@/actions/booking";
import { readSavedBookings } from "@/lib/saved-bookings";
import { formatInTz } from "@/lib/datetime";
import { formatServiceDuration, formatServicePrice } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingDetails } from "@/types";

export function MyBookings({ slug }: { slug: string }) {
  const [items, setItems] = React.useState<BookingDetails[] | null>(null);

  React.useEffect(() => {
    const tokens = readSavedBookings().filter((b) => b.slug === slug).map((b) => b.token);
    if (!tokens.length) return setItems([]);
    getBookingsByTokens(slug, tokens)
      .then(setItems)
      .catch(() => setItems([]));
  }, [slug]);

  if (items === null) {
    return (
      <div className="grid gap-3 pt-8" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-44 rounded-[1.75rem]" />
      </div>
    );
  }

  const upcoming = items.filter((b) => (b.status === "pending" || b.status === "confirmed") && new Date(b.end_at) > new Date());
  const past = items.filter((b) => !upcoming.includes(b));

  if (!items.length) {
    return (
      <div className="mx-auto grid max-w-sm justify-items-center pt-20 text-center animate-fade-up md:pt-28">
        <span className="grid size-[68px] place-items-center rounded-full border-2 border-foreground">
          <Check className="size-7" />
        </span>
        <h1 className="mt-7 text-[2.75rem] font-semibold">Здесь будет ваша запись</h1>
        <p className="mt-4 text-[1.0625rem] text-muted-foreground">
          Выберите услугу и время. Для восстановления записи откройте сохранённую приватную ссылку.
        </p>
        <Link href={`/s/${slug}/book`} className="mt-8 inline-flex h-14 items-center rounded-full bg-primary px-9 font-semibold text-primary-foreground">
          Выбрать услугу
        </Link>
        <Link href={`/login?next=/account`} className="mt-5 text-sm text-muted-foreground hover:text-foreground">
          Войти, чтобы увидеть все записи
        </Link>
      </div>
    );
  }

  const Card = ({ b }: { b: BookingDetails }) => (
    <Link
      href={`/s/${slug}/booking/${b.token}`}
      className="group block rounded-[1.75rem] border border-border bg-surface p-6 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm capitalize text-muted-foreground">
            {formatInTz(b.start_at, b.studio.timezone, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular">{formatInTz(b.start_at, b.studio.timezone, { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <StatusBadge status={b.status} short />
      </div>
      <p className="mt-4 text-[1.0625rem] font-medium">{b.service.name}</p>
      <p className="text-[0.9375rem] text-muted-foreground">
        {formatServiceDuration(b.service)} · {b.staff.name}
        {b.vehicle_model ? ` · ${b.vehicle_model}` : ""}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-semibold tabular">{formatServicePrice(b.price, b.studio.currency, b.service.price_from)}</span>
        <span className="flex items-center gap-1 text-sm text-muted-foreground group-hover:text-foreground">
          Управлять <ArrowUpRight className="size-4" />
        </span>
      </div>
    </Link>
  );

  return (
    <div className="pt-8">
      <h1 className="text-[2.5rem] font-semibold md:text-5xl">Моя запись</h1>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {upcoming.length ? upcoming.map((b) => <Card key={b.token} b={b} />) : <p className="text-muted-foreground">Предстоящих записей нет.</p>}
      </div>
      {past.length > 0 && (
        <>
          <h2 className="mt-12 text-2xl font-semibold">Ранее</h2>
          <div className="mt-4 grid gap-3 opacity-80 md:grid-cols-2">
            {past.map((b) => <Card key={b.token} b={b} />)}
          </div>
        </>
      )}
      <Link href={`/s/${slug}/book`} className="mt-10 inline-flex h-14 items-center rounded-full bg-primary px-9 font-semibold text-primary-foreground">
        Новая запись
      </Link>
    </div>
  );
}
