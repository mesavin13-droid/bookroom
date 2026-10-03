import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";
import { buildIcs } from "@/lib/booking/calendar";
import type { BookingDetails } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) return new NextResponse("Not found", { status: 404 });
  const { data } = await createPublicClient().rpc("get_booking_by_token", { p_token: token });
  if (!data) return new NextResponse("Not found", { status: 404 });
  const ics = buildIcs(data as BookingDetails);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${(data as BookingDetails).studio.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
