import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { AvailabilityError, loadAvailability } from "@/lib/booking/availability";
import { BOOKING_ERRORS, GENERIC_ERROR } from "@/lib/booking/errors";

export const dynamic = "force-dynamic";

const query = z.object({
  service: z.string().uuid(),
  staff: z.string().uuid().nullable(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  days: z.coerce.number().int().min(1).max(62).nullable(),
  reschedule: z.string().uuid().nullable(),
  admin: z.enum(["1"]).nullable(),
});

function fail(status: number, code: string, message?: string) {
  return NextResponse.json(
    { error: { code, message: message ?? BOOKING_ERRORS[code] ?? GENERIC_ERROR } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = req.nextUrl.searchParams;
  const parsed = query.safeParse({
    service: sp.get("service"),
    staff: sp.get("staff") && sp.get("staff") !== "any" ? sp.get("staff") : null,
    from: sp.get("from"),
    days: sp.get("days"),
    reschedule: sp.get("reschedule"),
    admin: sp.get("admin"),
  });
  if (!parsed.success) return fail(400, "INVALID_INPUT", "Некорректный запрос.");
  const q = parsed.data;

  try {
    // Admin mode uses the user's session (RLS) and skips online-only rules.
    const supabase = q.admin ? await createClient() : createPublicClient();
    const { data: studio, error } = await supabase
      .from("studios")
      .select("id, timezone, is_published")
      .eq("slug", slug)
      .maybeSingle();
    if (error) return fail(500, "LOAD_FAILED", GENERIC_ERROR);
    if (!studio) return fail(404, "STUDIO_NOT_FOUND");

    let ignoreRules = false;
    if (q.admin) {
      const { data: isManager } = await supabase.rpc("has_studio_role", { p_studio: studio.id });
      if (!isManager) return fail(403, "FORBIDDEN");
      ignoreRules = true;
    } else if (!studio.is_published) {
      return fail(404, "STUDIO_NOT_FOUND");
    }

    const result = await loadAvailability({
      supabase,
      studioId: studio.id,
      timezone: studio.timezone,
      serviceId: q.service,
      staffId: q.staff,
      from: q.from ?? undefined,
      days: q.days ?? undefined,
      excludeToken: q.reschedule,
      ignoreRules,
    });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof AvailabilityError) {
      const status = err.code === "LOAD_FAILED" ? 500 : 404;
      return fail(status, err.code, err.code === "LOAD_FAILED" ? GENERIC_ERROR : undefined);
    }
    console.error("[availability]", err);
    return fail(500, "LOAD_FAILED", GENERIC_ERROR);
  }
}
