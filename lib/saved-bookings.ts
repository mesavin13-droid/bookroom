/** Device-local list of booking tokens, so "Моя запись" works without an account. */
const KEY = "bookroom:bookings";

export interface SavedBooking {
  token: string;
  slug: string;
  savedAt: string;
}

export function readSavedBookings(): SavedBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x.token === "string" && typeof x.slug === "string") : [];
  } catch {
    return [];
  }
}

export function saveBooking(slug: string, token: string) {
  try {
    const list = readSavedBookings().filter((b) => b.token !== token);
    list.unshift({ token, slug, savedAt: new Date().toISOString() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    // storage unavailable (private mode): the confirmation link still works
  }
}

export function forgetBooking(token: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readSavedBookings().filter((b) => b.token !== token)));
  } catch {
    /* noop */
  }
}
