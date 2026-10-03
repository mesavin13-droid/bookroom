import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { CancelBooking } from "@/components/booking/booking-actions";
import { formatInTz } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";
import type { AccountAppointment } from "@/lib/data/account";

export function AppointmentCard({ a, actions = true }: { a: AccountAppointment; actions?: boolean }) {
  const tz = a.studio?.timezone ?? "Europe/Moscow";
  const active = a.status === "pending" || a.status === "confirmed";
  const slug = a.studio?.slug;
  return (
    <article className="relative grid gap-5 transition-colors hover:bg-surface/60 rounded-[1.25rem] border border-border p-5 md:grid-cols-[96px_1fr_auto] md:items-start md:gap-6">
      <div className="flex items-baseline gap-3 md:block">
        <span className="text-4xl font-medium tabular leading-none">{formatInTz(a.start_at, tz, { day: "2-digit" })}</span>
        <span className="text-sm text-muted-foreground md:mt-2 md:block">
          {formatInTz(a.start_at, tz, { month: "short", weekday: "short" })}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {slug ? (
            <Link href={`/s/${slug}/booking/${a.manage_token}`} className="text-lg font-medium after:absolute after:inset-0 after:rounded-[1.25rem] after:content-['']">
              {a.service?.name ?? "Услуга"}
            </Link>
          ) : (
            <p className="text-lg font-medium">{a.service?.name ?? "Услуга"}</p>
          )}
          <StatusBadge status={a.status} short />
        </div>
        <p className="mt-1 text-sm text-muted-foreground tabular">
          {formatInTz(a.start_at, tz, { hour: "2-digit", minute: "2-digit" })} · {a.studio?.name} · {a.staff?.name}
        </p>
        {a.studio?.address && <p className="mt-1 text-sm text-subtle">{a.studio.address}</p>}
      </div>
      <p className="text-lg font-medium tabular md:text-right">{formatPrice(a.price, a.studio?.currency)}</p>
      {actions && active && slug && (
        <div className="relative z-10 flex flex-wrap gap-2 md:col-span-3">
          <Button asChild variant="outline" size="sm">
            <Link href={`/s/${slug}/book?reschedule=${a.manage_token}`}>
              <CalendarClock /> Перенести
            </Link>
          </Button>
          <div className="[&_button]:h-9 [&_button]:px-3.5 [&_button]:text-[0.8125rem]">
            <CancelBooking token={a.manage_token} />
          </div>
        </div>
      )}
      {actions && !active && slug && a.service && (
        <div className="md:col-span-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/s/${slug}/book?service=${a.service.id}`}>Записаться снова</Link>
          </Button>
          {a.status === "completed" && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/s/${slug}/booking/${a.manage_token}`}>Оставить отзыв</Link>
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
