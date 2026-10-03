import { CalendarToolbar, type CalendarView } from "@/components/admin/calendar/toolbar";
import { DayView, MonthView, WeekView, toDaySchedules } from "@/components/admin/calendar/views";
import { getAdminContext, isManager } from "@/lib/admin/context";
import { getAppointmentsBetween } from "@/lib/data/admin";
import { addDaysKey, formatDateKey, isValidDateKey, isoWeekday, todayKey } from "@/lib/datetime";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string; staff?: string }> }) {
  const ctx = await getAdminContext();
  const sp = await searchParams;
  const tz = ctx.studio.timezone;
  const today = todayKey(tz);
  const view: CalendarView = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = sp.date && isValidDateKey(sp.date) ? sp.date : today;
  const manager = isManager(ctx.role);

  const { data: staffRows } = await ctx.supabase
    .from("staff")
    .select("id, name")
    .eq("studio_id", ctx.studio.id)
    .is("archived_at", null)
    .eq("is_active", true)
    .order("sort_order");
  let staff = (staffRows ?? []) as { id: string; name: string }[];
  if (!manager && ctx.staffId) staff = staff.filter((s) => s.id === ctx.staffId);
  const staffFilter = sp.staff && staff.some((s) => s.id === sp.staff) ? sp.staff : null;
  const visibleStaff = staffFilter ? staff.filter((s) => s.id === staffFilter) : staff;

  let from = date;
  let to = addDaysKey(date, 1);
  let prev = addDaysKey(date, -1);
  let next = addDaysKey(date, 1);
  let label = formatDateKey(date, { weekday: "long", day: "numeric", month: "long" });
  const monday = addDaysKey(date, 1 - isoWeekday(date));
  const month = date.slice(0, 7);
  const monthStart = `${month}-01`;
  const gridStart = addDaysKey(monthStart, 1 - isoWeekday(monthStart));

  if (view === "week") {
    from = monday;
    to = addDaysKey(monday, 7);
    prev = addDaysKey(monday, -7);
    next = addDaysKey(monday, 7);
    label = `${formatDateKey(monday, { day: "numeric", month: "short" })} – ${formatDateKey(addDaysKey(monday, 6), { day: "numeric", month: "short" })}`;
  } else if (view === "month") {
    from = gridStart;
    to = addDaysKey(gridStart, 42);
    prev = addDaysKey(monthStart, -1).slice(0, 7) + "-01";
    next = addDaysKey(monthStart, 32).slice(0, 7) + "-01";
    label = formatDateKey(monthStart, { month: "long", year: "numeric" });
  }

  const appointments = await getAppointmentsBetween(ctx, from, to, { staffId: staffFilter });

  let schedules: ReturnType<typeof toDaySchedules> = [];
  if (view === "day") {
    const ids = visibleStaff.map((s) => s.id);
    const [sch, br, off] = await Promise.all([
      ctx.supabase.from("staff_schedules").select("staff_id, weekday, is_working, start_time, end_time").in("staff_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ctx.supabase.from("schedule_breaks").select("staff_id, weekday, start_time, end_time").in("staff_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
      ctx.supabase.from("days_off").select("staff_id, start_date, end_date").eq("studio_id", ctx.studio.id).lte("start_date", date).gte("end_date", date),
    ]);
    schedules = toDaySchedules(ids, isoWeekday(date), date, sch.data ?? [], br.data ?? [], off.data ?? []);
  }

  return (
    <div>
      <CalendarToolbar
        view={view}
        date={date}
        label={label}
        prev={prev}
        next={next}
        today={today}
        staffId={staffFilter}
        staff={staff}
        canFilter={manager}
      />
      {view === "day" && (
        <DayView date={date} timezone={tz} staff={visibleStaff} schedules={schedules} appointments={appointments} canCreate={manager} />
      )}
      {view === "week" && <WeekView weekStart={monday} timezone={tz} appointments={appointments} today={today} />}
      {view === "month" && (
        <MonthView month={month} gridStart={gridStart} timezone={tz} currency={ctx.studio.currency} appointments={appointments} today={today} />
      )}
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-subtle">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-subtle/60 bg-surface-3" /> Подтверждена</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-dashed border-warning/60 bg-warning/10" /> Ожидает</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-border bg-surface-2" /> Завершена</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm border border-destructive/40 bg-destructive/10" /> Неявка</span>
      </p>
    </div>
  );
}
