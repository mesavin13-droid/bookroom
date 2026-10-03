import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { AppointmentStatusActions } from "@/components/admin/appointment-status-actions";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { getAdminContext, isManager } from "@/lib/admin/context";
import { APPOINTMENT_SELECT, getCatalog, type AdminAppointment } from "@/lib/data/admin";
import { formatDuration, formatInTz, toDateKey, toTimeKey } from "@/lib/datetime";
import { formatPhone, formatPrice, telHref } from "@/lib/format";

export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const ctx = await getAdminContext();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data } = await ctx.supabase.from("appointments").select(APPOINTMENT_SELECT).eq("id", id).eq("studio_id", ctx.studio.id).maybeSingle();
  if (!data) notFound();
  const a = data as unknown as AdminAppointment;
  const tz = ctx.studio.timezone;
  const manager = isManager(ctx.role);
  const editing = manager && sp.edit === "1";
  const duration = (new Date(a.end_at).getTime() - new Date(a.start_at).getTime()) / 60000;

  if (editing) {
    const catalog = await getCatalog(ctx);
    return (
      <div>
        <Link href={`/admin/appointments/${a.id}`} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> К записи
        </Link>
        <h1 className="mb-8 text-3xl font-medium">Изменить запись</h1>
        <AppointmentForm
          studioSlug={ctx.studio.slug}
          services={catalog.services}
          staff={catalog.staff}
          links={catalog.links}
          clients={[]}
          showVehicle={ctx.studio.vertical === "auto"}
          defaults={{
            id: a.id,
            clientName: a.client?.name ?? "",
            clientPhone: formatPhone(a.client?.phone),
            serviceId: a.service_id,
            staffId: a.staff_id,
            date: toDateKey(new Date(a.start_at), tz),
            time: toTimeKey(new Date(a.start_at), tz),
            price: Number(a.price),
            notes: a.notes ?? "",
            vehicleModel: a.vehicle_model ?? "",
            vehiclePlate: a.vehicle_plate ?? "",
            status: a.status,
          }}
        />
      </div>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ["Дата", <span key="d" className="capitalize">{formatInTz(a.start_at, tz, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>],
    ["Время", a.service?.duration_days
      ? `${formatInTz(a.start_at, tz, { hour: "2-digit", minute: "2-digit" })} → ${formatInTz(a.end_at, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ${a.service.duration_days} д`
      : `${formatInTz(a.start_at, tz, { hour: "2-digit", minute: "2-digit" })}–${formatInTz(a.end_at, tz, { hour: "2-digit", minute: "2-digit" })} · ${formatDuration(duration)}`],
    ["Услуга", a.service?.name],
    [ctx.studio.vertical === "auto" ? "Бокс" : "Специалист", a.staff?.name],
    ["Стоимость", formatPrice(a.price, ctx.studio.currency)],
    ["Источник", a.source === "online" ? "Онлайн-запись" : "Создана администратором"],
    ["Создана", formatInTz(a.created_at, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })],
  ];
  if (a.vehicle_model) rows.push(["Автомобиль", [a.vehicle_model, a.vehicle_plate].filter(Boolean).join(" · ")]);
  if (a.notes) rows.push(["Комментарий", a.notes]);

  return (
    <div className="max-w-3xl">
      <Link href="/admin/appointments" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Записи
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge status={a.status} />
          <h1 className="mt-4 text-3xl font-medium md:text-4xl">{a.client?.name}</h1>
          {a.client && (
            <a href={telHref(a.client.phone)} className="mt-2 inline-flex items-center gap-2 text-muted-foreground tabular hover:text-foreground">
              <Phone className="size-4" /> {formatPhone(a.client.phone)}
            </a>
          )}
        </div>
        {manager && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/admin/appointments/${a.id}?edit=1`}>Изменить / перенести</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-8">
        <AppointmentStatusActions id={a.id} status={a.status} />
      </div>

      <dl className="mt-10 grid gap-4 border-t border-border pt-8 text-[0.9375rem]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[120px_1fr] gap-4 md:grid-cols-[160px_1fr]">
            <dt className="text-subtle">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex flex-wrap gap-3 border-t border-border pt-8">
        {manager && a.client && (
          <Button asChild variant="secondary">
            <Link href={`/admin/clients/${a.client.id}`}>Карточка клиента</Link>
          </Button>
        )}
        <Button asChild variant="ghost">
          <a href={`/s/${ctx.studio.slug}/booking/${a.manage_token}`} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> Страница записи для клиента
          </a>
        </Button>
      </div>
    </div>
  );
}
