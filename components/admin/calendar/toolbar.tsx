"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarView = "day" | "week" | "month";

export function CalendarToolbar({
  view,
  date,
  label,
  prev,
  next,
  today,
  staffId,
  staff,
  canFilter,
}: {
  view: CalendarView;
  date: string;
  label: string;
  prev: string;
  next: string;
  today: string;
  staffId: string | null;
  staff: { id: string; name: string }[];
  canFilter: boolean;
}) {
  const router = useRouter();
  const href = (p: Partial<{ view: CalendarView; date: string; staff: string | null }>) => {
    const qs = new URLSearchParams({ view: p.view ?? view, date: p.date ?? date });
    const s = p.staff === undefined ? staffId : p.staff;
    if (s) qs.set("staff", s);
    return `/admin/calendar?${qs.toString()}`;
  };

  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Link href={href({ date: prev })} aria-label="Назад" className="grid size-10 place-items-center rounded-full border border-border hover:bg-surface">
          <ChevronLeft className="size-4" />
        </Link>
        <Link href={href({ date: next })} aria-label="Вперёд" className="grid size-10 place-items-center rounded-full border border-border hover:bg-surface">
          <ChevronRight className="size-4" />
        </Link>
        <Link href={href({ date: today })} className="h-10 rounded-full border border-border px-4 text-sm leading-10 hover:bg-surface">
          Сегодня
        </Link>
        <h1 className="ml-2 text-xl font-medium capitalize md:text-2xl">{label}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canFilter && staff.length > 1 && (
          <select
            aria-label="Специалист"
            value={staffId ?? ""}
            onChange={(e) => router.push(href({ staff: e.target.value || null }))}
            className="h-10 rounded-full border border-border bg-transparent px-4 text-sm outline-none hover:bg-surface"
          >
            <option value="">Все специалисты</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <div role="tablist" aria-label="Вид" className="flex rounded-full bg-surface p-1">
          {(["day", "week", "month"] as CalendarView[]).map((v) => (
            <Link
              key={v}
              role="tab"
              aria-selected={view === v}
              href={href({ view: v })}
              className={cn(
                "h-8 rounded-full px-4 text-sm leading-8 transition-colors",
                view === v ? "bg-surface-3 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "day" ? "День" : v === "week" ? "Неделя" : "Месяц"}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
