import { describe, expect, it } from "vitest";
import { computeDaySlots, type StaffAvailabilityInput, type SlotRules } from "./slots";
import { zonedTimeToUtc } from "@/lib/datetime";

const TZ = "Europe/Moscow";
// Friday 2026-10-02 06:00 Moscow
const NOW = zonedTimeToUtc("2026-10-02", "06:00", TZ);

const week = (start: string, end: string) =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, isWorking: weekday <= 5, start, end }));

const rules = (over: Partial<SlotRules> = {}): SlotRules => ({
  timeZone: TZ,
  durationMinutes: 60,
  stepMinutes: 30,
  minNoticeMinutes: 0,
  maxAdvanceDays: 30,
  now: NOW,
  ...over,
});

const ivan = (over: Partial<StaffAvailabilityInput> = {}): StaffAvailabilityInput => ({
  staffId: "ivan",
  hours: week("09:00", "18:00"),
  breaks: [],
  daysOff: [],
  busy: [],
  ...over,
});

describe("computeDaySlots", () => {
  it("builds a grid inside working hours that fits the service", () => {
    const day = computeDaySlots([ivan()], "2026-10-02", rules());
    expect(day.slots[0]!.time).toBe("09:00");
    expect(day.slots.at(-1)!.time).toBe("17:00");
    expect(day.slots).toHaveLength(17);
    expect(day.slots.every((s) => s.available)).toBe(true);
  });

  it("blocks slots overlapping an existing appointment (10:00-11:00)", () => {
    const busy = [{ start: zonedTimeToUtc("2026-10-02", "10:00", TZ), end: zonedTimeToUtc("2026-10-02", "11:00", TZ) }];
    const day = computeDaySlots([ivan({ busy })], "2026-10-02", rules());
    const t = (x: string) => day.slots.find((s) => s.time === x)!;
    expect(t("09:00").available).toBe(true);
    expect(t("09:30").available).toBe(false);
    expect(t("10:00").available).toBe(false);
    expect(t("10:30").available).toBe(false);
    expect(t("11:00").available).toBe(true);
  });

  it("respects breaks", () => {
    const day = computeDaySlots([ivan({ breaks: [{ weekday: 5, start: "13:00", end: "14:00" }] })], "2026-10-02", rules());
    const t = (x: string) => day.slots.find((s) => s.time === x)!;
    expect(t("12:00").available).toBe(true);
    expect(t("12:30").available).toBe(false);
    expect(t("13:30").available).toBe(false);
    expect(t("14:00").available).toBe(true);
  });

  it("returns nothing on weekends, days off and vacations", () => {
    expect(computeDaySlots([ivan()], "2026-10-03", rules()).slots).toHaveLength(0);
    const off = ivan({ daysOff: [{ startDate: "2026-10-05", endDate: "2026-10-09" }] });
    expect(computeDaySlots([off], "2026-10-07", rules()).isWorking).toBe(false);
  });

  it("applies minimum notice and the booking horizon", () => {
    const day = computeDaySlots([ivan()], "2026-10-02", rules({ minNoticeMinutes: 6 * 60 }));
    expect(day.slots[0]!.time).toBe("12:00");
    expect(computeDaySlots([ivan()], "2026-11-20", rules()).slots).toHaveLength(0);
    expect(computeDaySlots([ivan()], "2026-10-01", rules()).slots).toHaveLength(0);
  });

  it("merges specialists for 'any specialist'", () => {
    const anna: StaffAvailabilityInput = {
      staffId: "anna",
      hours: week("12:00", "20:00"),
      breaks: [],
      daysOff: [],
      busy: [{ start: zonedTimeToUtc("2026-10-02", "12:00", TZ), end: zonedTimeToUtc("2026-10-02", "13:00", TZ) }],
    };
    const busyIvan = [{ start: zonedTimeToUtc("2026-10-02", "12:00", TZ), end: zonedTimeToUtc("2026-10-02", "13:00", TZ) }];
    const day = computeDaySlots([ivan({ busy: busyIvan }), anna], "2026-10-02", rules());
    const t = (x: string) => day.slots.find((s) => s.time === x)!;
    expect(t("12:00").available).toBe(false);
    expect(t("13:00").staffIds.sort()).toEqual(["anna", "ivan"]);
    expect(t("18:00").staffIds).toEqual(["anna"]);
    expect(day.slots.at(-1)!.time).toBe("19:00");
  });

  it("converts local studio time to the right instant", () => {
    const day = computeDaySlots([ivan()], "2026-10-02", rules());
    expect(day.slots[0]!.startAt).toBe("2026-10-02T06:00:00.000Z");
  });

  it("books multi-day jobs from opening time and skips non-working days", () => {
    // Fri 2026-10-02, 2 working days: Fri + Mon (weekend off)
    const day = computeDaySlots([ivan()], "2026-10-02", rules({ durationDays: 2 }));
    expect(day.slots).toHaveLength(1);
    expect(day.slots[0]!.time).toBe("09:00");
    expect(day.slots[0]!.available).toBe(true);
    // A booking on Monday blocks the Friday start of a 2-day job
    const busy = [{ start: zonedTimeToUtc("2026-10-05", "15:00", TZ), end: zonedTimeToUtc("2026-10-05", "16:00", TZ) }];
    const blocked = computeDaySlots([ivan({ busy })], "2026-10-02", rules({ durationDays: 2 }));
    expect(blocked.slots[0]!.available).toBe(false);
  });
});
