"use client";

import { useEffect } from "react";
import { saveBooking } from "@/lib/saved-bookings";

/** Opening a private booking link restores it into "Моя запись" on this device. */
export function RememberBooking({ slug, token }: { slug: string; token: string }) {
  useEffect(() => saveBooking(slug, token), [slug, token]);
  return null;
}
