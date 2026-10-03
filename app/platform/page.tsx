import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { StateBadge } from "@/components/platform/state-badge";
import { requirePlatformAdmin, studioState, type PlatformOverview, type PlatformStudioRow } from "@/lib/platform";
import { formatPrice } from "@/lib/format";
import { formatDateKey } from "@/lib/datetime";

export const metadata = { title: "Сводка" };

export default async function PlatformHome() {
  const { supabase } = await requirePlatformAdmin();
  const [{ data: ov, error }, { data: latest }] = await Promise.all([
    supabase.rpc("platform_overview"),
    supabase.rpc("platform_studios", { p_q: null, p_status: "all", p_limit: 6, p_offset: 0 }),
  ]);
  if (error) throw new Error(error.message);
  const o = ov as PlatformOverview;
  const rows = ((latest as { items?: PlatformStudioRow[] } | null)?.items ?? []) as PlatformStudioRow[];
  const max = Math.max(1, ...o.daily.map((d) => d.bookings));

  const cards = [
    { label: "Всего студий", value: o.studios_total, note: `+${o.studios_new_7d} за 7 дней`, href: "/platform/studios" },
    { label: "Работают", value: o.studios_live, note: "опубликованы", href: "/platform/studios?status=live" },
    { label: "Черновики", value: o.studios_draft, note: "ещё настраиваются", href: "/platform/studios?status=draft" },
    { label: "Заблокированы", value: o.studios_suspended, note: "доступ закрыт", href: "/platform/studios?status=suspended" },
  ];
  const totals = [
    { label: "Владельцев", value: String(o.owners_total) },
    { label: "Клиентов в базах", value: String(o.clients_total) },
    { label: "Записей за 30 дней", value: String(o.appointments_30d) },
    { label: "Предстоящих записей", value: String(o.appointments_upcoming) },
    { label: "Выручка студий за 30 дней", value: formatPrice(o.revenue_30d) },
  ];

  return (
    <div>
      <PageHeader title="Платформа" description="Все студии, СТО и детейлинг-центры, которые подключились к сервису." />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="group bg-background p-5 transition-colors hover:bg-surface">
            <span className="flex items-center justify-between text-sm text-muted-foreground">
              {c.label} <ArrowUpRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </span>
            <span className="mt-2 block text-3xl font-medium tabular">{c.value}</span>
            <span className="mt-1 block text-xs text-subtle">{c.note}</span>
          </Link>
        ))}
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-5">
        {totals.map((t) => (
          <div key={t.label}>
            <dt className="text-xs text-subtle">{t.label}</dt>
            <dd className="mt-1 text-lg font-medium tabular">{t.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <h2 className="mb-4 text-xl font-medium">Новые записи по дням</h2>
          <div className="flex h-48 items-end gap-1.5 rounded-2xl border border-border p-4">
            {o.daily.map((d) => (
              <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end">
                <div className="rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${Math.max(2, (d.bookings / max) * 100)}%` }} />
                <span className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                  {formatDateKey(d.day.slice(0, 10), { day: "numeric", month: "short" })}: {d.bookings}
                  {d.studios ? `, новых студий ${d.studios}` : ""}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-subtle">
            <span>{o.daily[0] ? formatDateKey(o.daily[0].day.slice(0, 10), { day: "numeric", month: "short" }) : ""}</span>
            <span>сегодня</span>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-xl font-medium">Последние подключения</h2>
            <Link href="/platform/studios" className="text-sm text-muted-foreground hover:text-foreground">
              Все →
            </Link>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={`/platform/studios/${s.id}`} className="flex items-center justify-between gap-3 py-3.5 hover:bg-surface/60">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">{[s.kind, s.city].filter(Boolean).join(" · ") || s.slug}</span>
                  </span>
                  <StateBadge state={studioState(s)} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
