/**
 * Pure availability engine. No I/O: give it schedules, breaks, days off and
 * busy intervals, get bookable slots. The database re-validates every booking
 * (see book_appointment() in SQL), so this only drives the UI.
 */
import { addDaysKey, diffDaysKey, isoWeekday, minutesOf, timeOf, todayKey, zonedTimeToUtc } from "@/lib/datetime";

export interface WeeklyHours {
  weekday: number; // ISO 1..7
  isWorking: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface WeeklyBreak {
  weekday: number;
  start: string;
  end: string;
}

export interface DateRange {
  startDate: string; // yyyy-MM-dd inclusive
  endDate: string; // yyyy-MM-dd inclusive
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export interface StaffAvailabilityInput {
  staffId: string;
  hours: WeeklyHours[];
  breaks: WeeklyBreak[];
  daysOff: DateRange[];
  busy: BusyInterval[];
}

export interface SlotRules {
  timeZone: string;
  durationMinutes: number;
  stepMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  now: Date;
  /** Multi-day service: occupies N working days of the resource, starts at opening time. */
  durationDays?: number | null;
}

export interface Slot {
  time: string; // HH:mm local
  startAt: string; // ISO instant
  available: boolean;
  staffIds: string[]; // specialists free at this time
}

export interface DayAvailability {
  date: string;
  isWorking: boolean;
  slots: Slot[];
  availableCount: number;
}

export function bookableDateRange(rules: Pick<SlotRules, "timeZone" | "maxAdvanceDays" | "now">) {
  const first = todayKey(rules.timeZone, rules.now);
  return { first, last: addDaysKey(first, rules.maxAdvanceDays) };
}

export function isDateBookable(dateKey: string, rules: Pick<SlotRules, "timeZone" | "maxAdvanceDays" | "now">) {
  const { first } = bookableDateRange(rules);
  const diff = diffDaysKey(dateKey, first);
  return diff >= 0 && diff <= rules.maxAdvanceDays;
}

/** Working window (minutes from midnight) for one specialist on a date, or null. */
export function workingWindow(staff: Pick<StaffAvailabilityInput, "hours" | "daysOff">, dateKey: string) {
  if (staff.daysOff.some((r) => dateKey >= r.startDate && dateKey <= r.endDate)) return null;
  const wd = isoWeekday(dateKey);
  const h = staff.hours.find((x) => x.weekday === wd);
  if (!h || !h.isWorking) return null;
  const start = minutesOf(h.start);
  const end = minutesOf(h.end);
  return end > start ? { start, end } : null;
}

export function computeDaySlots(staffList: StaffAvailabilityInput[], dateKey: string, rules: SlotRules): DayAvailability {
  const empty: DayAvailability = { date: dateKey, isWorking: false, slots: [], availableCount: 0 };
  if (!isDateBookable(dateKey, rules) || rules.durationMinutes <= 0 || rules.stepMinutes <= 0) return empty;

  const earliest = rules.now.getTime() + rules.minNoticeMinutes * 60_000;
  if (rules.durationDays && rules.durationDays > 0) return computeMultiDay(staffList, dateKey, rules, earliest);
  const durMs = rules.durationMinutes * 60_000;
  const wd = isoWeekday(dateKey);
  const byMinute = new Map<number, { startAt: Date; staffIds: string[] }>();
  let isWorking = false;

  for (const staff of staffList) {
    const win = workingWindow(staff, dateKey);
    if (!win) continue;
    isWorking = true;
    const breaks = staff.breaks
      .filter((b) => b.weekday === wd)
      .map((b) => ({ start: minutesOf(b.start), end: minutesOf(b.end) }));

    for (let m = win.start; m + rules.durationMinutes <= win.end; m += rules.stepMinutes) {
      const startAt = zonedTimeToUtc(dateKey, timeOf(m), rules.timeZone);
      if (startAt.getTime() < earliest) continue;

      let entry = byMinute.get(m);
      if (!entry) {
        entry = { startAt, staffIds: [] };
        byMinute.set(m, entry);
      }

      const end = m + rules.durationMinutes;
      if (breaks.some((b) => m < b.end && end > b.start)) continue;

      const s = startAt.getTime();
      const e = s + durMs;
      if (staff.busy.some((b) => s < b.end.getTime() && e > b.start.getTime())) continue;

      entry.staffIds.push(staff.staffId);
    }
  }

  const slots = [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, v]) => ({
      time: timeOf(m),
      startAt: v.startAt.toISOString(),
      available: v.staffIds.length > 0,
      staffIds: v.staffIds,
    }));

  return { date: dateKey, isWorking, slots, availableCount: slots.filter((s) => s.available).length };
}

export function computeRange(staffList: StaffAvailabilityInput[], fromKey: string, days: number, rules: SlotRules) {
  const out: DayAvailability[] = [];
  for (let i = 0; i < days; i++) out.push(computeDaySlots(staffList, addDaysKey(fromKey, i), rules));
  return out;
}

/** End of a multi-day job: the N-th working day of the resource (non-working days are skipped). */
export function multiDayEnd(staff: Pick<StaffAvailabilityInput, "hours" | "daysOff">, startKey: string, days: number) {
  let found = 0;
  let endKey: string | null = null;
  let endMin = 0;
  for (let k = 0; k < 31 && found < days; k++) {
    const key = addDaysKey(startKey, k);
    const w = workingWindow(staff, key);
    if (w) {
      found++;
      endKey = key;
      endMin = w.end;
    }
  }
  return found === days && endKey ? { endKey, endMin } : null;
}

function computeMultiDay(staffList: StaffAvailabilityInput[], dateKey: string, rules: SlotRules, earliest: number): DayAvailability {
  const byMinute = new Map<number, { startAt: Date; staffIds: string[] }>();
  let isWorking = false;
  for (const staff of staffList) {
    const win = workingWindow(staff, dateKey);
    if (!win) continue;
    isWorking = true;
    const startAt = zonedTimeToUtc(dateKey, timeOf(win.start), rules.timeZone);
    if (startAt.getTime() < earliest) continue;
    let entry = byMinute.get(win.start);
    if (!entry) {
      entry = { startAt, staffIds: [] };
      byMinute.set(win.start, entry);
    }
    const end = multiDayEnd(staff, dateKey, rules.durationDays!);
    if (!end) continue;
    const s = startAt.getTime();
    const e = zonedTimeToUtc(end.endKey, timeOf(end.endMin), rules.timeZone).getTime();
    if (staff.busy.some((b) => s < b.end.getTime() && e > b.start.getTime())) continue;
    entry.staffIds.push(staff.staffId);
  }
  const slots = [...byMinute.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([m, v]) => ({ time: timeOf(m), startAt: v.startAt.toISOString(), available: v.staffIds.length > 0, staffIds: v.staffIds }));
  return { date: dateKey, isWorking, slots, availableCount: slots.filter((x) => x.available).length };
}
