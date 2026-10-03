/** Maps database error codes (raised in SQL) to human messages. */
export const BOOKING_ERRORS: Record<string, string> = {
  SLOT_TAKEN: "Это время только что заняли. Выберите другое.",
  SLOT_UNAVAILABLE: "Это время недоступно для записи. Выберите другое.",
  STAFF_UNAVAILABLE: "Специалист недоступен для этой услуги. Выберите другого мастера.",
  SERVICE_NOT_FOUND: "Услуга не найдена или больше не оказывается.",
  STUDIO_NOT_FOUND: "Студия не найдена.",
  TOO_SOON: "На это время уже нельзя записаться онлайн. Выберите время позже.",
  TOO_FAR: "Так далеко запись пока не открыта. Выберите дату ближе.",
  INVALID_PHONE: "Проверьте номер телефона.",
  INVALID_NAME: "Укажите имя.",
  INVALID_EMAIL: "Проверьте email.",
  INVALID_NOTES: "Комментарий слишком длинный.",
  VEHICLE_REQUIRED: "Укажите марку и модель автомобиля.",
  INVALID_VEHICLE: "Проверьте данные автомобиля.",
  CLIENT_BLOCKED: "Онлайн-запись для этого номера недоступна. Позвоните в студию.",
  NOT_FOUND: "Запись не найдена.",
  NOT_CANCELLABLE: "Эту запись уже нельзя отменить.",
  CANCEL_TOO_LATE: "Отменить запись онлайн уже нельзя, слишком мало времени до визита. Позвоните в студию.",
  NOT_RESCHEDULABLE: "Эту запись нельзя перенести.",
  RESCHEDULE_DISABLED: "Студия не разрешает перенос онлайн. Позвоните, мы поможем.",
  RESCHEDULE_TOO_LATE: "Перенести запись онлайн уже нельзя, слишком мало времени до визита.",
  REVIEW_NOT_ALLOWED: "Отзыв можно оставить после визита.",
  REVIEW_EXISTS: "Вы уже оставили отзыв об этом визите.",
  INVALID_RATING: "Поставьте оценку от 1 до 5.",
  INVALID_IMAGE: "Файл не похож на изображение JPG, PNG, WebP или AVIF.",
  INVALID_PHOTO: "Не удалось прикрепить фото.",
  SLUG_TAKEN: "Этот адрес уже занят. Придумайте другой.",
  INVALID_TIMEZONE: "Неизвестный часовой пояс.",
  AUTH_REQUIRED: "Войдите в аккаунт, чтобы продолжить.",
  FORBIDDEN: "Недостаточно прав для этого действия.",
  CROSS_STUDIO_REFERENCE: "Данные относятся к другой студии.",
  INVALID_RANGE: "Некорректный период.",
  TOO_MANY_BOOKINGS: "У вас уже есть 3 активные записи в эту студию. Перенесите или отмените одну из них.",
  RATE_LIMITED: "Слишком много записей подряд. Попробуйте через несколько минут или позвоните в студию.",
  LAST_OWNER: "Нельзя убрать последнего владельца студии.",
  STUDIO_LIMIT: "Можно создать не больше 10 студий на один аккаунт.",
  STUDIO_SUSPENDED: "Страница заблокирована администрацией платформы. Напишите в поддержку.",
  REASON_REQUIRED: "Укажите причину блокировки.",
  INVALID_ACTION: "Неизвестное действие.",
};

export const GENERIC_ERROR = "Что-то пошло не так. Попробуйте ещё раз через минуту.";
export const NETWORK_ERROR = "Нет соединения с интернетом. Проверьте сеть и попробуйте снова.";

interface PgLikeError {
  message?: string;
  code?: string;
  details?: string | null;
}

export function errorCode(err: unknown): string | undefined {
  const e = err as PgLikeError | null;
  if (!e) return undefined;
  if (e.code === "23P01") return "SLOT_TAKEN";
  if (e.message && BOOKING_ERRORS[e.message]) return e.message;
  return e.code;
}

export function humanizeError(err: unknown, fallback = GENERIC_ERROR): string {
  const e = err as PgLikeError | null;
  if (!e) return fallback;
  if (e.code === "23P01") return BOOKING_ERRORS.SLOT_TAKEN!;
  if (e.code === "23505") return "Такая запись уже существует.";
  if (e.code === "42501") return BOOKING_ERRORS.FORBIDDEN!;
  if (e.message && BOOKING_ERRORS[e.message]) return BOOKING_ERRORS[e.message]!;
  if (e.message && /fetch failed|network|ECONN/i.test(e.message)) return NETWORK_ERROR;
  return fallback;
}
