import Link from "next/link";
import { ArrowUpRight, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { SmartImage } from "@/components/smart-image";
import { requireManagerPage } from "@/lib/admin/context";
import { getAppointmentsBetween, todayRange, APPOINTMENT_SELECT, type AdminAppointment } from "@/lib/data/admin";
import { addDaysKey, formatDateKey, formatInTz, hhmm, isoWeekday, minutesOf } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";
import { plural } from "@/lib/utils";

export default async function DashboardPage() {
  const ctx = await requireManagerPage();
  const { today, from, to } = todayRange(ctx);
  const tz = ctx.studio.timezone;
  const wd = isoWeekday(today);

  const [todayAppts, newClients, cancellations, upcomingRes, staffRes, schedRes, breaksRes, offRes] = await Promise.all([
    getAppointmentsBetween(ctx, today, addDaysKey(today, 1)),
    ctx.supabase.from("clients").select("id", { count: "exact", head: true }).eq("studio_id", ctx.studio.id).gte("created_at", from).lt("created_at", to),
    ctx.supabase.from("appointments").select("id", { count: "exact", head: true }).eq("studio_id", ctx.studio.id).gte("cancelled_at", from).lt("cancelled_at", to),
    ctx.supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("studio_id", ctx.studio.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_at", new Date().toISOString())
      .order("start_at")
      .limit(8),
    ctx.supabase.from("staff").select("id, name, photo_url").eq("studio_id", ctx.studio.id).eq("is_active", true).is("archived_at", null).order("sort_order"),
    ctx.supabase.from("staff_schedules").select("staff_id, is_working, start_time, end_time").eq("studio_id", ctx.studio.id).eq("weekday", wd),
    ctx.supabase.from("schedule_breaks").select("staff_id, start_time, end_time").eq("studio_id", ctx.studio.id).eq("weekday", wd),
    ctx.supabase.from("days_off").select("staff_id").eq("studio_id", ctx.studio.id).lte("start_date", today).gte("end_date", today),
  ]);

  const revenue = todayAppts.filter((a) => a.status === "completed").reduce((s, a) => s + a.price, 0);
  const expected = todayAppts.filter((a) => a.status !== "no_show").reduce((s, a) => s + a.price, 0);
  const upcoming = (upcomingRes.data ?? []) as unknown as AdminAppointment[];
  const pending = upcoming.filter((a) => a.status === "pending").length;
  const offIds = new Set((offRes.data ?? []).map((d: { staff_id: string }) => d.staff_id));

  type LoadRow = { id: string; name: string; photo_url: string | null; working: boolean | undefined; capacity: number; booked: number; pct: number };
  const load: LoadRow[] = ((staffRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]).map((s: { id: string; name: string; photo_url: string | null }) => {
    const sch = (schedRes.data ?? []).find((x: { staff_id: string }) => x.staff_id === s.id) as
      | { is_working: boolean; start_time: string; end_time: string }
      | undefined;
    const working = sch?.is_working && !offIds.has(s.id);
    const breakMin = (breaksRes.data ?? [])
      .filter((b: { staff_id: string }) => b.staff_id === s.id)
      .reduce((m: number, b: { start_time: string; end_time: string }) => m + minutesOf(hhmm(b.end_time)) - minutesOf(hhmm(b.start_time)), 0);
    const capacity = working && sch ? minutesOf(hhmm(sch.end_time)) - minutesOf(hhmm(sch.start_time)) - breakMin : 0;
    const booked = todayAppts
      .filter((a) => a.staff_id === s.id && a.status !== "no_show")
      .reduce((m, a) => m + (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000, 0);
    return { ...s, working, capacity, booked, pct: capacity ? Math.min(100, Math.round((booked / capacity) * 100)) : 0 };
  });

  const stats = [
    { href: `/admin/calendar?view=day&date=${today}`, label: "Записей сегодня", value: String(todayAppts.length), note: `${todayAppts.filter((a) => a.status === "completed").length} завершено` },
    { href: "/admin/appointments?scope=today&status=completed", label: "Выручка сегодня", value: formatPrice(revenue, ctx.studio.currency), note: `ожидается ${formatPrice(expected, ctx.studio.currency)}` },
    { href: "/admin/clients", label: "Новых клиентов", value: String(newClients.count ?? 0), note: "за сегодня" },
    { href: "/admin/appointments?scope=today&status=cancelled", label: "Отмены", value: String(cancellations.count ?? 0), note: "за сегодня" },
  ];

  return (
    <div>
      <PageHeader
        title="Сегодня"
        description={<span className="capitalize">{formatDateKey(today, { weekday: "long", day: "numeric", month: "long" })}</span>}
        actions={
          <Button asChild>
            <Link href="/admin/appointments/new">
              <CalendarPlus /> Новая запись
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="group bg-background p-5 transition-colors hover:bg-surface">
            <span className="flex items-center justify-between text-sm text-muted-foreground">
              {s.label} <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="mt-2 block text-2xl font-medium tabular md:text-3xl">{s.value}</span>
            <span className="mt-1 block text-xs text-subtle">{s.note}</span>
          </Link>
        ))}
      </div>

      {pending > 0 && (
        <Link href="/admin/appointments?status=pending" className="mt-6 flex items-center justify-between rounded-2xl bg-surface px-5 py-4 text-sm hover:bg-surface-2">
          <span>
            <span className="font-medium">{pending}</span> {plural(pending, ["запись ждёт", "записи ждут", "записей ждут"])} подтверждения
          </span>
          <ArrowUpRight className="size-4 text-muted-foreground" />
        </Link>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-medium">Ближайшие записи</h2>
            <Link href="/admin/calendar" className="text-sm text-muted-foreground hover:text-foreground">
              Календарь →
            </Link>
          </div>
          {upcoming.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/appointments/${a.id}`} className="grid grid-cols-[64px_1fr_auto] items-center gap-4 py-4 transition-colors hover:bg-surface/60">
                    <div className="tabular">
                      <p className="text-lg font-medium leading-none">{formatInTz(a.start_at, tz, { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="mt-1 text-xs text-subtle">{formatInTz(a.start_at, tz, { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.client?.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {a.service?.name} · {a.staff?.name}
                      </p>
                    </div>
                    <StatusBadge status={a.status} short />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarPlus} title="Предстоящих записей нет" description="Поделитесь ссылкой на страницу студии с клиентами." />
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-medium">Загрузка специалистов</h2>
          <ul className="grid gap-5">
            {load.map((s) => (
              <li key={s.id}>
                <Link href={`/admin/calendar?view=day&date=${today}&staff=${s.id}`} className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-xl p-1 -m-1 transition-colors hover:bg-surface">
                <span className="relative size-10 overflow-hidden rounded-full">
                  <SmartImage src={s.photo_url} alt="" fallbackLabel={s.name} fill sizes="40px" />
                </span>
                <div>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-muted-foreground tabular">{s.working ? `${s.pct}%` : "выходной"}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-foreground transition-[width] duration-700" style={{ width: `${s.pct}%` }} />
                  </div>
                  {s.working && (
                    <p className="mt-1.5 text-xs text-subtle tabular">
                      {Math.round(s.booked / 60 * 10) / 10} из {Math.round(s.capacity / 60 * 10) / 10} ч
                    </p>
                  )}
                </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
