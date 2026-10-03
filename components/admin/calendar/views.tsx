import Link from "next/link";
import { WEEKDAY_SHORT, addDaysKey, formatInTz, hhmm, isoWeekday, minutesOf, timeOf, toDateKey, toTimeKey } from "@/lib/datetime";
import { formatPrice } from "@/lib/format";
import { cn, initials } from "@/lib/utils";
import type { AdminAppointment } from "@/lib/data/admin";
import type { AppointmentStatus } from "@/types";

const PX = 1.25; // px per minute
const STEP = 30;

const statusStyle: Record<AppointmentStatus, string> = {
  confirmed: "bg-surface-3 border-subtle/60 text-foreground",
  pending: "bg-warning/10 border-warning/50 border-dashed text-foreground",
  completed: "bg-surface-2 border-border text-muted-foreground",
  no_show: "bg-destructive/10 border-destructive/40 text-muted-foreground",
  cancelled: "bg-transparent border-border text-subtle line-through",
};

function spansDay(a: AdminAppointment, d: string, timezone: string) {
  const s = toDateKey(new Date(a.start_at), timezone);
  const e = toDateKey(new Date(new Date(a.end_at).getTime() - 1), timezone);
  return s <= d && d <= e;
}

export interface DaySchedule {
  staffId: string;
  working: boolean;
  start: string | null;
  end: string | null;
  breaks: { start: string; end: string }[];
}

export function DayView({
  date,
  timezone,
  staff,
  schedules,
  appointments,
  canCreate,
}: {
  date: string;
  timezone: string;
  staff: { id: string; name: string }[];
  schedules: DaySchedule[];
  appointments: AdminAppointment[];
  canCreate: boolean;
}) {
  const working = schedules.filter((s) => s.working && s.start && s.end);
  const dayStart = Math.floor(Math.min(...working.map((s) => minutesOf(s.start!)), 9 * 60) / 60) * 60;
  const dayEnd = Math.ceil(Math.max(...working.map((s) => minutesOf(s.end!)), 20 * 60) / 60) * 60;
  const height = (dayEnd - dayStart) * PX;
  const hours: number[] = [];
  for (let m = dayStart; m < dayEnd; m += 60) hours.push(m);
  const now = new Date();
  const isToday = toDateKey(now, timezone) === date;
  const nowMin = minutesOf(toTimeKey(now, timezone));

  if (!staff.length) {
    return <p className="text-muted-foreground">Добавьте специалистов, чтобы вести расписание.</p>;
  }

  return (
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <div className="min-w-fit rounded-2xl border border-border">
        {/* Header */}
        <div className="sticky top-0 z-10 flex border-b border-border bg-background">
          <div className="w-14 shrink-0" />
          {staff.map((s) => {
            const sch = schedules.find((x) => x.staffId === s.id);
            return (
              <div key={s.id} className="min-w-[168px] flex-1 border-l border-border px-3 py-3">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-subtle tabular">{sch?.working ? `${sch.start}–${sch.end}` : "выходной"}</p>
              </div>
            );
          })}
        </div>
        {/* Body */}
        <div className="relative flex">
          <div className="relative w-14 shrink-0" style={{ height }}>
            {hours.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-[0.6875rem] text-subtle tabular" style={{ top: (m - dayStart) * PX }}>
                {m > dayStart ? timeOf(m) : ""}
              </span>
            ))}
          </div>
          {staff.map((s) => {
            const sch = schedules.find((x) => x.staffId === s.id);
            const cells: { m: number; free: boolean }[] = [];
            for (let m = dayStart; m < dayEnd; m += STEP) {
              const inHours = !!sch?.working && m >= minutesOf(sch.start!) && m + STEP <= minutesOf(sch.end!);
              const inBreak = sch?.breaks.some((b) => m < minutesOf(b.end) && m + STEP > minutesOf(b.start));
              cells.push({ m, free: inHours && !inBreak });
            }
            const own = appointments.filter((a) => a.staff_id === s.id);
            return (
              <div key={s.id} className="relative min-w-[168px] flex-1 border-l border-border" style={{ height }}>
                {cells.map((c) =>
                  c.free && canCreate ? (
                    <Link
                      key={c.m}
                      href={`/admin/appointments/new?date=${date}&time=${timeOf(c.m)}&staff=${s.id}`}
                      className={cn(
                        "group absolute inset-x-0 flex items-center px-2 text-[0.6875rem] text-transparent transition-colors hover:bg-surface hover:text-muted-foreground",
                        c.m % 60 === 0 && "border-t border-border/60",
                      )}
                      style={{ top: (c.m - dayStart) * PX, height: STEP * PX }}
                      aria-label={`Свободно ${timeOf(c.m)}, создать запись`}
                    >
                      + {timeOf(c.m)}
                    </Link>
                  ) : (
                    <div
                      key={c.m}
                      className={cn(
                        "absolute inset-x-0",
                        !c.free && "bg-[repeating-linear-gradient(135deg,oklch(var(--surface))_0_6px,transparent_6px_12px)]",
                        c.m % 60 === 0 && "border-t border-border/60",
                      )}
                      style={{ top: (c.m - dayStart) * PX, height: STEP * PX }}
                    />
                  ),
                )}
                {own.map((a) => {
                  // Multi-day jobs: clip to this day's visible range.
                  const sKey = toDateKey(new Date(a.start_at), timezone);
                  const eKey = toDateKey(new Date(new Date(a.end_at).getTime() - 1), timezone);
                  const start = sKey < date ? dayStart : minutesOf(toTimeKey(new Date(a.start_at), timezone));
                  const endM = eKey > date ? dayEnd : minutesOf(toTimeKey(new Date(a.end_at), timezone)) || dayEnd;
                  const dur = Math.max(endM - start, 15);
                  return (
                    <Link
                      key={a.id}
                      href={`/admin/appointments/${a.id}`}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-lg border px-2 py-1.5 text-xs leading-tight transition-[transform,background-color] duration-150 hover:z-10 hover:scale-[1.01]",
                        statusStyle[a.status],
                      )}
                      style={{ top: (start - dayStart) * PX + 1, height: Math.max(dur * PX - 2, 22) }}
                    >
                      <p className="font-medium tabular">
                        {sKey < date ? "→ " : formatInTz(a.start_at, timezone, { hour: "2-digit", minute: "2-digit" }) + " · "}
                        {a.client?.name}
                      </p>
                      {dur >= 40 && (
                        <p className="mt-0.5 truncate text-muted-foreground">
                          {a.service?.name}
                          {a.vehicle_model ? ` · ${a.vehicle_model}` : ""}
                          {eKey > date ? " · продолжается" : ""}
                        </p>
                      )}
                    </Link>
                  );
                })}
                {isToday && nowMin >= dayStart && nowMin <= dayEnd && (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20 h-px bg-destructive" style={{ top: (nowMin - dayStart) * PX }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function WeekView({
  weekStart,
  timezone,
  appointments,
  today,
}: {
  weekStart: string;
  timezone: string;
  appointments: AdminAppointment[];
  today: string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(weekStart, i));
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-7">
      {days.map((d) => {
        const list = appointments.filter((a) => spansDay(a, d, timezone));
        return (
          <section key={d} className="min-h-[120px] bg-background p-3 md:min-h-[420px]">
            <Link href={`/admin/calendar?view=day&date=${d}`} className="mb-3 flex items-baseline gap-2">
              <span className="text-xs tracking-[0.1em] text-subtle">{WEEKDAY_SHORT[isoWeekday(d)]}</span>
              <span className={cn("text-lg font-medium tabular", d === today && "rounded-full bg-primary px-2 text-primary-foreground")}>
                {d.slice(8, 10)}
              </span>
              <span className="ml-auto text-xs text-subtle tabular">{list.length || ""}</span>
            </Link>
            <ul className="grid gap-1.5">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/appointments/${a.id}`} className={cn("block rounded-lg border px-2 py-1.5 text-xs leading-tight", statusStyle[a.status])}>
                    <span className="font-medium tabular">{formatInTz(a.start_at, timezone, { hour: "2-digit", minute: "2-digit" })}</span>{" "}
                    {a.client?.name}
                    <span className="mt-0.5 block truncate text-muted-foreground">
                      {a.service?.name} · {a.staff ? initials(a.staff.name) : ""}
                    </span>
                  </Link>
                </li>
              ))}
              {!list.length && <li className="text-xs text-subtle">Свободно</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function MonthView({
  month,
  gridStart,
  timezone,
  currency,
  appointments,
  today,
}: {
  month: string;
  gridStart: string;
  timezone: string;
  currency: string;
  appointments: AdminAppointment[];
  today: string;
}) {
  const cells: string[] = [];
  for (let k = gridStart; cells.length < 42; k = addDaysKey(k, 1)) {
    cells.push(k);
    if (cells.length % 7 === 0 && addDaysKey(k, 1).slice(0, 7) > month) break;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_SHORT.slice(1).map((w) => (
          <span key={w} className="px-2 py-2 text-center text-[0.6875rem] tracking-[0.1em] text-subtle md:text-left">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-border">
        {cells.map((d) => {
          const list = appointments.filter((a) => spansDay(a, d, timezone));
          const sum = list.reduce((s, a) => s + a.price, 0);
          const inMonth = d.slice(0, 7) === month;
          return (
            <Link
              key={d}
              href={`/admin/calendar?view=day&date=${d}`}
              className={cn("min-h-[68px] bg-background p-2 transition-colors hover:bg-surface md:min-h-[110px] md:p-3", !inMonth && "opacity-40")}
            >
              <span className={cn("text-sm tabular", d === today && "rounded-full bg-primary px-1.5 text-primary-foreground")}>{Number(d.slice(8, 10))}</span>
              {list.length > 0 && (
                <div className="mt-2 grid gap-0.5">
                  <span className="text-xs font-medium tabular">
                    <span className="md:hidden">{list.length}</span>
                    <span className="hidden md:inline">{list.length} зап.</span>
                  </span>
                  <span className="hidden text-xs text-subtle tabular md:block">{formatPrice(sum, currency)}</span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function toDaySchedules(
  staffIds: string[],
  weekday: number,
  date: string,
  schedules: { staff_id: string; weekday: number; is_working: boolean; start_time: string; end_time: string }[],
  breaks: { staff_id: string; weekday: number; start_time: string; end_time: string }[],
  daysOff: { staff_id: string; start_date: string; end_date: string }[],
): DaySchedule[] {
  return staffIds.map((id) => {
    const s = schedules.find((x) => x.staff_id === id && x.weekday === weekday);
    const off = daysOff.some((d) => d.staff_id === id && date >= d.start_date && date <= d.end_date);
    return {
      staffId: id,
      working: Boolean(s?.is_working) && !off,
      start: s ? hhmm(s.start_time) : null,
      end: s ? hhmm(s.end_time) : null,
      breaks: breaks.filter((b) => b.staff_id === id && b.weekday === weekday).map((b) => ({ start: hhmm(b.start_time), end: hhmm(b.end_time) })),
    };
  });
}
