import Link from "next/link";
import { Bell, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AppointmentCard } from "@/components/account/appointment-card";
import { MarkReadButton } from "@/components/account/mark-read";
import { getMyAppointments, getMyNotifications } from "@/lib/data/account";
import { formatInTz } from "@/lib/datetime";

export default async function AccountOverview() {
  const [upcoming, history, notifications] = await Promise.all([
    getMyAppointments("upcoming"),
    getMyAppointments("history"),
    getMyNotifications(),
  ]);
  const next = upcoming[0];
  const lastStudio = history[0]?.studio ?? next?.studio;
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="grid gap-12">
      <section>
        <h1 className="text-3xl font-medium md:text-4xl">Ближайший визит</h1>
        <div className="mt-6">
          {next ? (
            <AppointmentCard a={next} />
          ) : (
            <EmptyState
              icon={CalendarPlus}
              title="Нет предстоящих записей"
              description="Записи, сделанные с этим email или телефоном, появятся здесь автоматически."
              action={
                lastStudio ? (
                  <Button asChild>
                    <Link href={`/s/${lastStudio.slug}/book`}>Записаться в {lastStudio.name}</Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline">
                    <Link href="/">Найти студию</Link>
                  </Button>
                )
              }
            />
          )}
        </div>
        {upcoming.length > 1 && (
          <Link href="/account/appointments" className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground">
            Ещё {upcoming.length - 1} в предстоящих →
          </Link>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Уведомления</h2>
          {unread > 0 && <MarkReadButton />}
        </div>
        {notifications.length ? (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 py-4">
                <span aria-hidden className={`mt-2 size-1.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-subtle" dateTime={n.created_at}>
                  {formatInTz(n.created_at, "Europe/Moscow", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Bell className="size-4" /> Здесь появятся подтверждения, переносы и напоминания.
          </p>
        )}
      </section>
    </div>
  );
}
