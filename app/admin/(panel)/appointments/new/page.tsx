import { PageHeader } from "@/components/admin/page-header";
import { AppointmentForm } from "@/components/admin/appointment-form";
import { requireManagerPage } from "@/lib/admin/context";
import { getCatalog } from "@/lib/data/admin";
import { isValidDateKey, todayKey } from "@/lib/datetime";
import { formatPhone } from "@/lib/format";

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; time?: string; staff?: string; service?: string; client?: string }>;
}) {
  const ctx = await requireManagerPage();
  const sp = await searchParams;
  const [catalog, clientsRes] = await Promise.all([
    getCatalog(ctx),
    ctx.supabase.from("clients").select("id, name, phone").eq("studio_id", ctx.studio.id).order("name").limit(1000),
  ]);
  const clients = (clientsRes.data ?? []) as { id: string; name: string; phone: string }[];
  const preClient = sp.client ? clients.find((c) => c.id === sp.client) : undefined;
  const staffId = catalog.staff.find((s) => s.id === sp.staff)?.id ?? catalog.staff[0]?.id ?? "";
  const serviceId =
    catalog.services.find((s) => s.id === sp.service)?.id ??
    catalog.services.find((s) => catalog.links.some((l) => l.staff_id === staffId && l.service_id === s.id))?.id ??
    catalog.services[0]?.id ??
    "";
  const service = catalog.services.find((s) => s.id === serviceId);

  return (
    <div>
      <PageHeader title="Новая запись" description="Запись создаётся сразу, клиенту не нужен аккаунт." />
      {catalog.services.length && catalog.staff.length ? (
        <AppointmentForm
          studioSlug={ctx.studio.slug}
          services={catalog.services}
          staff={catalog.staff}
          links={catalog.links}
          clients={clients}
          showVehicle={ctx.studio.vertical === "auto"}
          defaults={{
            clientName: preClient?.name ?? "",
            clientPhone: preClient ? formatPhone(preClient.phone) : "",
            serviceId,
            staffId,
            date: sp.date && isValidDateKey(sp.date) ? sp.date : todayKey(ctx.studio.timezone),
            time: sp.time && /^\d{2}:\d{2}$/.test(sp.time) ? sp.time : "",
            price: service?.price ?? 0,
            notes: "",
            vehicleModel: "",
            vehiclePlate: "",
            status: "confirmed",
          }}
        />
      ) : (
        <p className="text-muted-foreground">Сначала добавьте хотя бы одну услугу и специалиста.</p>
      )}
    </div>
  );
}
