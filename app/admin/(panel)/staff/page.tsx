import Link from "next/link";
import { UserSquare } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { NewStaffSheet } from "@/components/admin/staff-form";
import { EmptyState } from "@/components/empty-state";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { requireManagerPage } from "@/lib/admin/context";
import { getCatalog } from "@/lib/data/admin";
import { WEEKDAY_SHORT, hhmm } from "@/lib/datetime";

export default async function StaffPage() {
  const ctx = await requireManagerPage();
  const catalog = await getCatalog(ctx);
  const { data: schedules } = await ctx.supabase
    .from("staff_schedules")
    .select("staff_id, weekday, is_working, start_time, end_time")
    .eq("studio_id", ctx.studio.id)
    .order("weekday");

  return (
    <div>
      <PageHeader title={ctx.studio.vertical === "auto" ? "Боксы" : "Специалисты"} description={`${catalog.staff.length} ${ctx.studio.vertical === "auto" ? "в работе" : "в команде"}`} actions={<NewStaffSheet services={catalog.services} />} />
      {catalog.staff.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {catalog.staff.map((s) => {
            const services = catalog.links.filter((l) => l.staff_id === s.id).length;
            const days = (schedules ?? []).filter((x: { staff_id: string; is_working: boolean }) => x.staff_id === s.id && x.is_working) as {
              weekday: number;
              start_time: string;
              end_time: string;
            }[];
            return (
              <li key={s.id}>
                <Link href={`/admin/staff/${s.id}`} className="flex items-center gap-4 rounded-2xl border border-border p-4 transition-colors hover:border-subtle hover:bg-surface">
                  <span className="relative size-16 shrink-0 overflow-hidden rounded-full">
                    <SmartImage src={s.photo_url} alt="" fallbackLabel={s.name} fill sizes="64px" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{s.name}</p>
                      {!s.is_active && <Badge variant="muted">Скрыт</Badge>}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{s.position ?? "Без должности"}</p>
                    <p className="mt-1 truncate text-xs text-subtle">
                      {services} усл. · {days.length ? days.map((d) => WEEKDAY_SHORT[d.weekday]).join(" ") : "нет рабочих дней"}
                      {days[0] && ` · ${hhmm(days[0].start_time)}–${hhmm(days[0].end_time)}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={UserSquare} title="Добавьте первого специалиста" description="Клиенты смогут выбрать мастера при записи." />
      )}
    </div>
  );
}
