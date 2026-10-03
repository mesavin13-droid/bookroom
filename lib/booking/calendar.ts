import { SITE_URL } from "@/lib/config";
import type { BookingDetails } from "@/types";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");

export function bookingUrl(b: Pick<BookingDetails, "token" | "studio">) {
  return `${SITE_URL}/s/${b.studio.slug}/booking/${b.token}`;
}

export function buildIcs(b: BookingDetails) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BOOKROOM//Booking//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${b.id}@bookroom`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.start_at)}`,
    `DTEND:${stamp(b.end_at)}`,
    `SUMMARY:${esc(`${b.service.name} · ${b.studio.name}`)}`,
    `DESCRIPTION:${esc(`Мастер: ${b.staff.name}\nУправление записью: ${bookingUrl(b)}`)}`,
    b.studio.address ? `LOCATION:${esc(b.studio.address)}` : "",
    b.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(b.service.name)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}

export function googleCalendarUrl(b: BookingDetails) {
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.service.name} · ${b.studio.name}`,
    dates: `${stamp(b.start_at)}/${stamp(b.end_at)}`,
    details: `Мастер: ${b.staff.name}\n${bookingUrl(b)}`,
    location: b.studio.address ?? "",
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
