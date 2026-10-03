"use client";

import { ArrowLeft, ArrowRight, CalendarSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateKey } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DayAvailability, Slot } from "@/lib/booking/slots";

const PARTS = [
  { label: "Утро", test: (t: string) => t < "12:00" },
  { label: "День", test: (t: string) => t >= "12:00" && t < "17:00" },
  { label: "Вечер", test: (t: string) => t >= "17:00" },
];

export function SlotGrid({
  day,
  selected,
  onSelect,
  onPrev,
  onNext,
  nextAvailable,
  onJump,
}: {
  day: DayAvailability | undefined;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  onPrev?: () => void;
  onNext?: () => void;
  nextAvailable?: string | null;
  onJump?: (date: string) => void;
}) {
  if (!day || day.availableCount === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-6 py-10 text-center animate-in fade-in">
        <CalendarSearch className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-base font-medium">На этот день свободных записей нет</p>
        {nextAvailable && onJump && (
          <button
            type="button"
            onClick={() => onJump(nextAvailable)}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Ближайшая свободная дата: {formatDateKey(nextAvailable, { weekday: "short", day: "numeric", month: "long" })}
          </button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPrev} disabled={!onPrev}>
            <ArrowLeft /> Предыдущий день
          </Button>
          <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext}>
            Следующий день <ArrowRight />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 animate-in fade-in duration-300" key={day.date}>
      {PARTS.map((part) => {
        const slots = day.slots.filter((s) => part.test(s.time));
        if (!slots.length) return null;
        return (
          <div key={part.label}>
            <p className="eyebrow mb-3">{part.label}</p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
              {slots.map((s) => {
                const isSel = s.startAt === selected;
                return (
                  <button
                    key={s.startAt}
                    type="button"
                    disabled={!s.available}
                    aria-pressed={isSel}
                    onClick={() => onSelect(s)}
                    className={cn(
                      "h-12 rounded-xl border text-[0.9375rem] font-medium tabular transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                      isSel
                        ? "border-primary bg-primary text-primary-foreground"
                        : s.available
                          ? "border-border bg-surface hover:border-subtle"
                          : "cursor-not-allowed border-transparent text-subtle/60 line-through decoration-subtle/40",
                    )}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SlotGridSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Загружаем свободное время">
      <div className="h-4 w-16 animate-pulse rounded bg-surface-2" />
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-surface" style={{ animationDelay: `${i * 40}ms` }} />
        ))}
      </div>
    </div>
  );
}
