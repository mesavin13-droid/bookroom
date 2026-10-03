const money = new Map<string, Intl.NumberFormat>();

export function formatPrice(value: number | string | null | undefined, currency = "RUB") {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  let f = money.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("ru-RU", { style: "currency", currency, maximumFractionDigits: 0 });
    money.set(currency, f);
  }
  return f.format(n);
}

export function formatPhone(phone: string | null | undefined) {
  if (!phone) return "";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("7")) {
    return `+7 ${d.slice(1, 4)} ${d.slice(4, 7)}-${d.slice(7, 9)}-${d.slice(9, 11)}`;
  }
  return phone;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function formatServicePrice(value: number | string, currency = "RUB", from = false) {
  return `${from ? "от " : ""}${formatPrice(value, currency)}`;
}

/** "45 мин", "2 ч", "1 д". */
export function formatServiceDuration(s: { duration_minutes: number; duration_days?: number | null }) {
  if (s.duration_days) return `${s.duration_days} д`;
  const m = s.duration_minutes;
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h} ч ${m % 60} мин` : `${h} ч`;
}
