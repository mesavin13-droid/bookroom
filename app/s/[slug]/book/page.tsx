import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { Button } from "@/components/ui/button";
import { getStudioPageData } from "@/lib/data/studio";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/format";
import { BOOKING_ERRORS } from "@/lib/booking/errors";
import type { BookingDetails } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getStudioPageData((await params).slug).catch(() => null);
  return data ? { title: `Запись — ${data.studio.name}`, robots: { index: false } } : {};
}

type SP = { service?: string; staff?: string; date?: string; reschedule?: string };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await getStudioPageData(slug);
  if (!data) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let reschedule: { token: string; serviceId: string; staffId: string; startAt: string } | null = null;
  if (sp.reschedule) {
    if (!/^[0-9a-f-]{36}$/i.test(sp.reschedule)) notFound();
    const { data: b } = await supabase.rpc("get_booking_by_token", { p_token: sp.reschedule });
    const booking = b as BookingDetails | null;
    if (!booking || booking.studio.slug !== slug) notFound();
    if (!booking.can_reschedule) {
      return (
        <main className="container max-w-xl py-20">
          <p className="eyebrow">Перенос записи</p>
          <h1 className="mt-4 text-4xl font-medium">Перенести онлайн не получится</h1>
          <p className="mt-4 text-muted-foreground">
            {data.settings.allow_reschedule ? BOOKING_ERRORS.RESCHEDULE_TOO_LATE : BOOKING_ERRORS.RESCHEDULE_DISABLED}
            {data.studio.phone && ` Телефон студии: ${formatPhone(data.studio.phone)}.`}
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link href={`/s/${slug}/booking/${booking.token}`}>К записи</Link>
          </Button>
        </main>
      );
    }
    reschedule = { token: booking.token, serviceId: booking.service.id, staffId: booking.staff.id, startAt: booking.start_at };
  }

  let defaults: { name?: string; phone?: string; email?: string } = {};
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user.id).maybeSingle();
    defaults = {
      name: profile?.full_name ?? undefined,
      phone: profile?.phone ? formatPhone(profile.phone) : user.phone ? formatPhone(`+${user.phone}`) : undefined,
      email: profile?.email ?? user.email ?? undefined,
    };
  }

  return (
    <BookingWizard
      studio={{
        slug: data.studio.slug,
        name: data.studio.name,
        address: data.studio.address,
        currency: data.studio.currency,
        timezone: data.studio.timezone,
        vertical: data.studio.vertical,
      }}
      services={data.services}
      categories={data.categories}
      staff={data.staff}
      initial={{ serviceId: sp.service, staffId: sp.staff, date: sp.date }}
      defaults={defaults}
      reschedule={reschedule}
    />
  );
}
