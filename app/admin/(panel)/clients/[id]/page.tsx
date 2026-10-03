import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { ClientSheet, DeleteClientButton } from "@/components/admin/client-form";
import { requireManagerPage } from "@/lib/admin/context";
import { APPOINTMENT_SELECT, type AdminAppointment } from "@/lib/data/admin";
import { formatInTz } from "@/lib/datetime";
import { formatPhone, formatPrice, telHref } from "@/lib/format";
import type { Client } from "@/types";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireManagerPage();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [{ data: client }, { data: stats }, { data: appts }] = await Promise.all([
    ctx.supabase.from("clients").select("*").eq("id", id).eq("studio_id", ctx.studio.id).maybeSingle(),
    ctx.supabase.from("client_stats").select("*").eq("client_id", id).maybeSingle(),
    ctx.supabase.from("appointments").select(APPOINTMENT_SELECT).eq("client_id", id).order("start_at", { ascending: false }).limit(200),
  ]);
  if (!client) notFound();
  const c = client as Client;
  const list = (appts ?? []) as unknown as AdminAppointment[];
  const tz = ctx.studio.timezone;

  return (
    <div className="max-w-4xl">
      <Link href="/admin/clients" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Клиенты
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-medium md:text-4xl">{c.name}</h1>
            {c.status === "vip" && <Badge variant="inverse">VIP</Badge>}
            {c.status === "blocked" && <Badge variant="destructive">Заблокирован</Badge>}
            {c.profile_id && <Badge variant="outline">Есть аккаунт</Badge>}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
            <a href={telHref(c.phone)} className="inline-flex items-center gap-2 tabular hover:text-foreground">
              <Phone className="size-4" /> {formatPhone(c.phone)}
            </a>
            {c.email && (
              <a href={`mailto:${c.email}`} className="inline-flex items-center gap-2 hover:text-foreground">
                <Mail className="size-4" /> {c.email}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/admin/appointments/new?client=${c.id}`}>
              <CalendarPlus /> Записать
            </Link>
          </Button>
          <ClientSheet
            trigger={<Button variant="outline">Изменить</Button>}
            defaults={{ id: c.id, name: c.name, phone: formatPhone(c.phone), email: c.email ?? "", notes: c.notes ?? "", status: c.status }}
          />
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        {[
          ["Визиты", String(stats?.visits ?? 0)],
          ["Всего записей", String(stats?.total_appointments ?? 0)],
          ["Сумма", formatPrice(stats?.total_spent ?? 0, ctx.studio.currency)],
        ].map(([k, v]) => (
          <div key={k} className="bg-background p-4 md:p-5">
            <dt className="text-xs text-subtle md:text-sm">{k}</dt>
            <dd className="mt-1 text-xl font-medium tabular md:text-2xl">{v}</dd>
          </div>
        ))}
      </dl>

      {c.notes && (
        <div className="mt-6 rounded-2xl bg-surface p-5">
          <p className="eyebrow mb-2">Заметки</p>
          <p className="whitespace-pre-line text-[0.9375rem]">{c.notes}</p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-medium">История записей</h2>
        {list.length ? (
          <ul className="divide-y divide-border border-y border-border">
            {list.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/appointments/${a.id}`} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 py-4 hover:bg-surface/60 md:grid-cols-[180px_1fr_auto_auto]">
                  <span className="tabular">{formatInTz(a.start_at, tz, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="col-start-1 text-muted-foreground md:col-start-auto">
                    {a.service?.name} · {a.staff?.name}
                  </span>
                  <span className="col-start-2 row-start-1 text-right tabular md:col-start-auto md:row-start-auto">{formatPrice(a.price, ctx.studio.currency)}</span>
                  <span className="col-start-2 row-start-2 justify-self-end md:col-start-auto md:row-start-auto">
                    <StatusBadge status={a.status} short />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">Записей пока нет.</p>
        )}
      </section>

      {list.length === 0 && (
        <div className="mt-10">
          <DeleteClientButton id={c.id} />
        </div>
      )}
    </div>
  );
}
