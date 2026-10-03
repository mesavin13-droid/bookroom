"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Coffee, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { WEEKDAY_LONG, formatDateKey } from "@/lib/datetime";
import { addDayOff, deleteDayOff, saveWeeklySchedule } from "@/actions/admin/schedule";
import { cn } from "@/lib/utils";
import type { DayOffKind } from "@/types";

type Day = { weekday: number; isWorking: boolean; start: string; end: string };
type Break = { key: string; weekday: number; start: string; end: string };

export function WeeklyScheduleEditor({ staffId, days: initialDays, breaks: initialBreaks }: { staffId: string; days: Day[]; breaks: Omit<Break, "key">[] }) {
  const router = useRouter();
  const [days, setDays] = React.useState(initialDays);
  const [breaks, setBreaks] = React.useState<Break[]>(initialBreaks.map((b, i) => ({ ...b, key: `b${i}` })));
  const [pending, start] = React.useTransition();
  const [dirty, setDirty] = React.useState(false);

  const update = (wd: number, patch: Partial<Day>) => {
    setDays((d) => d.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)));
    setDirty(true);
  };
  const copyToAll = (wd: number) => {
    const src = days.find((d) => d.weekday === wd)!;
    setDays((d) => d.map((x) => (x.isWorking ? { ...x, start: src.start, end: src.end } : x)));
    setDirty(true);
  };

  return (
    <div>
      <ul className="divide-y divide-border rounded-2xl border border-border">
        {days.map((d) => {
          const own = breaks.filter((b) => b.weekday === d.weekday);
          return (
            <li key={d.weekday} className="grid gap-3 px-4 py-4 md:grid-cols-[180px_1fr] md:items-start">
              <label className="flex items-center gap-3">
                <Switch checked={d.isWorking} onCheckedChange={(v) => update(d.weekday, { isWorking: v })} aria-label={`${WEEKDAY_LONG[d.weekday]}: рабочий день`} />
                <span className={cn("font-medium", !d.isWorking && "text-subtle")}>{WEEKDAY_LONG[d.weekday]}</span>
              </label>
              {d.isWorking ? (
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input type="time" step={900} value={d.start} onChange={(e) => update(d.weekday, { start: e.target.value })} className="h-10 w-[120px]" aria-label="Начало" />
                    <span className="text-subtle">–</span>
                    <Input type="time" step={900} value={d.end} onChange={(e) => update(d.weekday, { end: e.target.value })} className="h-10 w-[120px]" aria-label="Конец" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBreaks((b) => [...b, { key: crypto.randomUUID(), weekday: d.weekday, start: "14:00", end: "15:00" }]);
                        setDirty(true);
                      }}
                    >
                      <Coffee /> Перерыв
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => copyToAll(d.weekday)} className="hidden md:inline-flex">
                      На все рабочие дни
                    </Button>
                  </div>
                  {own.map((b) => (
                    <div key={b.key} className="flex flex-wrap items-center gap-2 pl-1 text-sm text-muted-foreground">
                      <span className="w-16">Перерыв</span>
                      <Input
                        type="time"
                        step={900}
                        value={b.start}
                        onChange={(e) => {
                          setBreaks((all) => all.map((x) => (x.key === b.key ? { ...x, start: e.target.value } : x)));
                          setDirty(true);
                        }}
                        className="h-9 w-[110px]"
                        aria-label="Начало перерыва"
                      />
                      <span>–</span>
                      <Input
                        type="time"
                        step={900}
                        value={b.end}
                        onChange={(e) => {
                          setBreaks((all) => all.map((x) => (x.key === b.key ? { ...x, end: e.target.value } : x)));
                          setDirty(true);
                        }}
                        className="h-9 w-[110px]"
                        aria-label="Конец перерыва"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Удалить перерыв"
                        onClick={() => {
                          setBreaks((all) => all.filter((x) => x.key !== b.key));
                          setDirty(true);
                        }}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-subtle md:pt-2">Выходной</p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="sticky bottom-20 z-10 mt-4 flex items-center gap-3 lg:bottom-4">
        <Button
          size="lg"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await saveWeeklySchedule({ staffId, days, breaks: breaks.map(({ weekday, start, end }) => ({ weekday, start, end })) });
              if (res.ok) {
                toast.success("Расписание сохранено");
                setDirty(false);
                router.refresh();
              } else toast.error(res.error);
            })
          }
        >
          Сохранить расписание
        </Button>
        {dirty && <span className="text-sm text-muted-foreground">Есть несохранённые изменения</span>}
      </div>
    </div>
  );
}

const KIND_LABEL: Record<DayOffKind, string> = { day_off: "Выходной", vacation: "Отпуск", sick_leave: "Больничный" };

export function DaysOffEditor({
  staffId,
  items,
  today,
}: {
  staffId: string;
  items: { id: string; start_date: string; end_date: string; kind: DayOffKind; reason: string | null }[];
  today: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [form, setForm] = React.useState({ startDate: today, endDate: today, kind: "day_off" as DayOffKind, reason: "" });

  return (
    <div className="grid gap-6">
      {items.length > 0 && (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {items.map((d) => (
            <li key={d.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1">
                <p className="font-medium">
                  {formatDateKey(d.start_date, { day: "numeric", month: "long" })}
                  {d.end_date !== d.start_date && ` – ${formatDateKey(d.end_date, { day: "numeric", month: "long" })}`}
                </p>
                <p className="text-sm text-muted-foreground">
                  {KIND_LABEL[d.kind]}
                  {d.reason && ` · ${d.reason}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Удалить"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteDayOff(d.id);
                    if (res.ok) router.refresh();
                    else toast.error(res.error);
                  })
                }
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-4 rounded-2xl bg-surface p-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addDayOff({ staffId, ...form });
            if (res.ok) {
              toast.success("Добавлено. Эти дни закрыты для записи.");
              setForm((f) => ({ ...f, reason: "" }));
              router.refresh();
            } else toast.error(res.error);
          });
        }}
      >
        <Field label="С">
          <Input type="date" min={today} value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate }))} className="h-10" />
        </Field>
        <Field label="По">
          <Input type="date" min={form.startDate} value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="h-10" />
        </Field>
        <Field label="Тип">
          <NativeSelect value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as DayOffKind }))} className="h-10">
            {Object.entries(KIND_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" loading={pending}>
          <Plus /> Добавить
        </Button>
      </form>
    </div>
  );
}
