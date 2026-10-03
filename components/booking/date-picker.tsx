"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { WEEKDAY_SHORT, addDaysKey, formatDateKey, isoWeekday } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DayAvailability } from "@/lib/booking/slots";

/** Mobile: horizontal strip of upcoming dates. */
export function DateStrip({
  days,
  selected,
  onSelect,
}: {
  days: DayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selected]);

  return (
    <div ref={ref} className="no-scrollbar -mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label="Дата">
      {days.map((d, i) => {
        const wd = isoWeekday(d.date);
        const isSelected = d.date === selected;
        const has = d.availableCount > 0;
        const newMonth = i === 0 || d.date.slice(5, 7) !== days[i - 1]!.date.slice(5, 7);
        return (
          <div key={d.date} className="flex shrink-0 snap-start flex-col gap-1.5">
            <span className={cn("h-4 text-[0.6875rem] uppercase tracking-[0.12em] text-subtle", !newMonth && "invisible")}>
              {formatDateKey(d.date, { month: "short" }).replace(".", "")}
            </span>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              aria-pressed={isSelected}
              aria-label={`${formatDateKey(d.date, { weekday: "long", day: "numeric", month: "long" })}${has ? "" : ", нет свободного времени"}`}
              onClick={() => onSelect(d.date)}
              className={cn(
                "flex h-[72px] w-14 flex-col items-center justify-center gap-1 rounded-2xl border transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                isSelected
                  ? "border-primary bg-primary text-primary-foreground"
                  : has
                    ? "border-border bg-surface text-foreground hover:border-subtle"
                    : "border-transparent text-subtle",
              )}
            >
              <span className={cn("text-[0.6875rem] font-medium tracking-[0.08em]", isSelected ? "" : wd >= 6 ? "text-muted-foreground" : "")}>
                {WEEKDAY_SHORT[wd]}
              </span>
              <span className="text-lg font-medium tabular leading-none">{d.date.slice(8, 10)}</span>
              <span
                aria-hidden
                className={cn("size-1 rounded-full", has ? (isSelected ? "bg-primary-foreground" : "bg-success") : "bg-transparent")}
              />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Desktop: month grid limited to the booking horizon. */
export function MonthCalendar({
  days,
  selected,
  onSelect,
}: {
  days: DayAvailability[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const byDate = React.useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const first = days[0]?.date;
  const last = days.at(-1)?.date;
  const [month, setMonth] = React.useState(() => (selected ?? first ?? "").slice(0, 7));
  React.useEffect(() => {
    if (selected) setMonth(selected.slice(0, 7));
  }, [selected]);
  if (!first || !last) return null;

  const monthStart = `${month}-01`;
  const offset = isoWeekday(monthStart) - 1;
  const cells: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let k = monthStart; k.slice(0, 7) === month; k = addDaysKey(k, 1)) cells.push(k);
  const prevMonth = addDaysKey(monthStart, -1).slice(0, 7);
  const nextMonth = addDaysKey(monthStart, 32).slice(0, 7);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-base font-medium capitalize">{formatDateKey(monthStart, { month: "long", year: "numeric" })}</p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Предыдущий месяц"
            disabled={prevMonth < first.slice(0, 7)}
            onClick={() => setMonth(prevMonth)}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Следующий месяц"
            disabled={nextMonth > last.slice(0, 7)}
            onClick={() => setMonth(nextMonth)}
            className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_SHORT.slice(1).map((w) => (
          <span key={w} className="pb-2 text-[0.6875rem] font-medium tracking-[0.1em] text-subtle">
            {w}
          </span>
        ))}
        {cells.map((k, i) => {
          if (!k) return <span key={`e${i}`} />;
          const d = byDate.get(k);
          const has = (d?.availableCount ?? 0) > 0;
          const isSel = k === selected;
          return (
            <button
              key={k}
              type="button"
              disabled={!d}
              onClick={() => onSelect(k)}
              aria-pressed={isSel}
              className={cn(
                "relative grid aspect-square place-items-center rounded-xl text-sm tabular transition-colors duration-150",
                isSel
                  ? "bg-primary text-primary-foreground"
                  : has
                    ? "text-foreground hover:bg-surface-2"
                    : d
                      ? "text-subtle hover:bg-surface"
                      : "text-subtle/40",
              )}
            >
              {Number(k.slice(8, 10))}
              {has && !isSel && <span aria-hidden className="absolute bottom-1.5 size-1 rounded-full bg-success" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
