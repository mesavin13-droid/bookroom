import Link from "next/link";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DaysOffEditor, WeeklyScheduleEditor } from "@/components/admin/schedule-editor";
import { EmptyState } from "@/components/empty-state";
import { SmartImage } from "@/components/smart-image";
import { requireManagerPage } from "@/lib/admin/context";
import { hhmm, todayKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DayOffKind } from "@/types";

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ staff?: string }> }) {
  const ctx = await requireManagerPage();
  const sp = await searchParams;
  const { data: staffRows } = await ctx.supabase
    .from("staff")
    .select("id, name, photo_url")
    .eq("studio_id", ctx.studio.id)
    .is("archived_at", null)
    .order("sort_order");
  const staff = (staffRows ?? []) as { id: string; name: string; photo_url: string | null }[];
  if (!staff.length) {
    return (
      <div>
        <PageHeader title="Расписание" />
        <EmptyState icon={Clock} title="Нет специалистов" description="Добавьте специалиста, чтобы настроить рабочие часы." />
      </div>
    );
  }
  const current = staff.find((s) => s.id === sp.staff) ?? staff[0]!;
  const today = todayKey(ctx.studio.timezone);

  const [sch, br, off] = await Promise.all([
    ctx.supabase.from("staff_schedules").select("weekday, is_working, start_time, end_time").eq("staff_id", current.id),
    ctx.supabase.from("schedule_breaks").select("weekday, start_time, end_time").eq("staff_id", current.id).order("start_time"),
    ctx.supabase.from("days_off").select("id, start_date, end_date, kind, reason").eq("staff_id", current.id).gte("end_date", today).order("start_date"),
  ]);

  const days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const row = (sch.data ?? []).find((r: { weekday: number }) => r.weekday === weekday) as
      | { is_working: boolean; start_time: string; end_time: string }
      | undefined;
    return { weekday, isWorking: row?.is_working ?? false, start: row ? hhmm(row.start_time) : "10:00", end: row ? hhmm(row.end_time) : "19:00" };
  });
  const breaks = (br.data ?? []).map((b: { weekday: number; start_time: string; end_time: string }) => ({
    weekday: b.weekday,
    start: hhmm(b.start_time),
    end: hhmm(b.end_time),
  }));

  return (
    <div className="max-w-4xl">
      <PageHeader title="Расписание" description="Рабочие часы, перерывы и отпуска. Онлайн-запись учитывает всё автоматически." />
      <div className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {staff.map((s) => (
          <Link
            key={s.id}
            href={`/admin/schedule?staff=${s.id}`}
            className={cn(
              "flex h-11 shrink-0 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm transition-colors",
              s.id === current.id ? "border-foreground bg-surface-2" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="relative size-8 overflow-hidden rounded-full">
              <SmartImage src={s.photo_url} alt="" fallbackLabel={s.name} fill sizes="32px" />
            </span>
            {s.name}
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-4 text-xl font-medium">Неделя</h2>
        <WeeklyScheduleEditor key={current.id} staffId={current.id} days={days} breaks={breaks} />
      </section>

      <section className="mt-14">
        <h2 className="text-xl font-medium">Выходные и отпуск</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Существующие записи на эти дни не отменяются автоматически, проверьте календарь.</p>
        <DaysOffEditor
          key={current.id}
          staffId={current.id}
          today={today}
          items={(off.data ?? []) as { id: string; start_date: string; end_date: string; kind: DayOffKind; reason: string | null }[]}
        />
      </section>
    </div>
  );
}
