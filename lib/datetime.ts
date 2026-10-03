/**
 * Timezone-safe date helpers built on Intl (no runtime tz database needed).
 * A "date key" is a calendar date string `yyyy-MM-dd` in the studio's timezone.
 */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter(timeZone).formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour) % 24,
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS[out.weekday!] ?? 1,
  };
}

function offsetMs(date: Date, timeZone: string) {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Converts a wall-clock time in `timeZone` to an absolute instant. */
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const o1 = offsetMs(new Date(guess), timeZone);
  let result = guess - o1;
  const o2 = offsetMs(new Date(result), timeZone);
  if (o2 !== o1) result = guess - o2;
  return new Date(result);
}

export function toDateKey(date: Date, timeZone: string) {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toTimeKey(date: Date, timeZone: string) {
  const p = getZonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayKey(timeZone: string, now: Date = new Date()) {
  return toDateKey(now, timeZone);
}

export function addDaysKey(dateKey: string, days: number) {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function diffDaysKey(a: string, b: string) {
  const toUtc = (k: string) => {
    const [y, m, d] = k.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(a) - toUtc(b)) / 86_400_000);
}

/** ISO weekday (1 = Monday ... 7 = Sunday) of a date key. */
export function isoWeekday(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function isValidDateKey(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  return addDaysKey(v, 0) === v;
}

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

export function timeOf(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Trims "HH:mm:ss" from Postgres to "HH:mm". */
export function hhmm(time: string) {
  return time.slice(0, 5);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
export function formatInTz(date: Date | string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const key = timeZone + JSON.stringify(options);
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat("ru-RU", { timeZone, ...options });
    fmtCache.set(key, f);
  }
  return f.format(typeof date === "string" ? new Date(date) : date);
}

/** Formats a date key (no tz shift) using UTC as the reference zone. */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions) {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return formatInTz(new Date(Date.UTC(y, m - 1, d, 12)), "UTC", options);
}

export const WEEKDAY_SHORT = ["", "ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"] as const;
export const WEEKDAY_LONG = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"] as const;

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ч ${m} мин` : `${h} ч`;
}
