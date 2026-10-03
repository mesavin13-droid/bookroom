import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

const uuid = z.string().uuid();
const optionalText = (max: number) => z.string().trim().max(max, `Не длиннее ${max} символов`).optional().or(z.literal(""));
const phone = z
  .string()
  .trim()
  .min(1, "Укажите телефон")
  .refine((v) => normalizePhone(v) !== null, "Проверьте номер телефона");
const optionalEmail = z.string().trim().email("Проверьте email").optional().or(z.literal(""));
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Время в формате ЧЧ:ММ");
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД");

// ---------- Public booking ----------
export const bookingDetailsSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(80, "Слишком длинное имя"),
  phone,
  email: optionalEmail,
  notes: optionalText(500),
  vehicleModel: optionalText(80),
  vehiclePlate: optionalText(20),
  consent: z.boolean().refine((v) => v, "Нужно согласие на обработку данных"),
});
export type BookingDetailsValues = z.infer<typeof bookingDetailsSchema>;

export const createBookingSchema = bookingDetailsSchema.extend({
  slug: z.string().min(1),
  serviceId: uuid,
  staffId: uuid.nullable(),
  startAt: z.string().datetime({ offset: true }),
});

export const rescheduleSchema = z.object({ token: uuid, startAt: z.string().datetime({ offset: true }) });
export const cancelSchema = z.object({ token: uuid, reason: optionalText(300) });

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Поставьте оценку").max(5),
  comment: optionalText(2000),
  authorName: z.string().trim().min(1, "Укажите имя").max(80),
});
export type ReviewValues = z.infer<typeof reviewSchema>;

// ---------- Account ----------
export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Укажите имя").max(120),
  phone: z.string().trim().refine((v) => v === "" || normalizePhone(v) !== null, "Проверьте номер телефона"),
  telegramUsername: z
    .string()
    .trim()
    .regex(/^@?[a-zA-Z0-9_]{0,32}$/, "Только латиница, цифры и _")
    .optional()
    .or(z.literal("")),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const notificationPrefsSchema = z.object({
  notifyEmail: z.boolean(),
  notifySms: z.boolean(),
  notifyTelegram: z.boolean(),
});

// ---------- Admin ----------
export const studioCreateSchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, "3–48 символов: латиница, цифры, дефис"),
  timezone: z.string().min(1),
  vertical: z.enum(["beauty", "auto"]),
  kind: z.string().trim().min(2, "Укажите вид деятельности").max(80),
  city: z.string().trim().min(2, "Укажите город").max(80),
  address: optionalText(200),
  phone,
  ownerName: z.string().trim().min(2, "Как к вам обращаться?").max(80),
});
export type StudioCreateValues = z.infer<typeof studioCreateSchema>;

export const studioProfileSchema = z.object({
  name: z.string().trim().min(2, "Минимум 2 символа").max(80),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/, "3–48 символов: латиница, цифры, дефис"),
  kind: optionalText(80),
  tagline: optionalText(160),
  description: optionalText(4000),
  address: optionalText(200),
  city: optionalText(80),
  phone: z.string().trim().refine((v) => v === "" || normalizePhone(v) !== null, "Проверьте номер телефона"),
  email: optionalEmail,
  website: z.string().trim().url("Укажите адрес с https://").refine((v) => /^https?:\/\/[^\s]+$/i.test(v), "Только ссылки http:// или https://").optional().or(z.literal("")),
  telegram: optionalText(64),
  vk: optionalText(64),
  instagram: optionalText(64),
  timezone: z.string().min(1),
  vertical: z.enum(["beauty", "auto"]),
  isPublished: z.boolean(),
});
export type StudioProfileValues = z.infer<typeof studioProfileSchema>;

export const bookingSettingsSchema = z.object({
  minNoticeMinutes: z.number().int().min(0).max(10080),
  maxAdvanceDays: z.number().int().min(1).max(180),
  cancelNoticeMinutes: z.number().int().min(0).max(10080),
  allowReschedule: z.boolean(),
  autoConfirm: z.boolean(),
  slotStepMinutes: z.number().int().refine((v) => [10, 15, 20, 30, 60].includes(v), "Шаг: 10, 15, 20, 30 или 60 минут"),
});
export type BookingSettingsValues = z.infer<typeof bookingSettingsSchema>;

export const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Минимум 2 символа").max(100),
  description: optionalText(1000),
  categoryId: uuid.nullable().or(z.literal("")),
  price: z.number({ invalid_type_error: "Укажите цену" }).min(0, "Цена не может быть отрицательной").max(10_000_000),
  durationMinutes: z.number({ invalid_type_error: "Укажите длительность" }).int().min(5, "Минимум 5 минут").max(720),
  durationDays: z.number().int().min(1, "Минимум 1 день").max(14, "Максимум 14 дней").nullable(),
  priceFrom: z.boolean(),
  isActive: z.boolean(),
  staffIds: z.array(uuid),
});
export type ServiceValues = z.infer<typeof serviceSchema>;

export const categorySchema = z.object({ id: uuid.optional(), name: z.string().trim().min(1, "Введите название").max(60) });

export const staffSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Минимум 2 символа").max(80),
  position: optionalText(80),
  bio: optionalText(1000),
  isActive: z.boolean(),
  serviceIds: z.array(uuid),
});
export type StaffValues = z.infer<typeof staffSchema>;

export const weeklyScheduleSchema = z.object({
  staffId: uuid,
  days: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), isWorking: z.boolean(), start: time, end: time })
        .refine((d) => !d.isWorking || d.end > d.start, { message: "Конец позже начала", path: ["end"] }),
    )
    .length(7),
  breaks: z
    .array(
      z
        .object({ weekday: z.number().int().min(1).max(7), start: time, end: time })
        .refine((b) => b.end > b.start, { message: "Конец перерыва позже начала", path: ["end"] }),
    )
    .max(50),
});
export type WeeklyScheduleValues = z.infer<typeof weeklyScheduleSchema>;

export const dayOffSchema = z
  .object({
    staffId: uuid,
    startDate: dateKey,
    endDate: dateKey,
    kind: z.enum(["day_off", "vacation", "sick_leave"]),
    reason: optionalText(200),
  })
  .refine((d) => d.endDate >= d.startDate, { message: "Дата окончания не раньше начала", path: ["endDate"] });
export type DayOffValues = z.infer<typeof dayOffSchema>;

export const clientSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Укажите имя").max(120),
  phone,
  email: optionalEmail,
  notes: optionalText(2000),
  status: z.enum(["active", "vip", "blocked"]),
});
export type ClientValues = z.infer<typeof clientSchema>;

export const adminAppointmentSchema = z.object({
  id: uuid.optional(),
  clientName: z.string().trim().min(1, "Укажите имя клиента").max(120),
  clientPhone: phone,
  serviceId: uuid,
  staffId: uuid,
  date: dateKey,
  time,
  price: z.number({ invalid_type_error: "Укажите стоимость" }).min(0).max(10_000_000),
  notes: optionalText(1000),
  vehicleModel: optionalText(80),
  vehiclePlate: optionalText(20),
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
});
export type AdminAppointmentValues = z.infer<typeof adminAppointmentSchema>;

export const appointmentStatusSchema = z.object({
  id: uuid,
  status: z.enum(["pending", "confirmed", "completed", "cancelled", "no_show"]),
});

export function fieldErrorsFrom(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
