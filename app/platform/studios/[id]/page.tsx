import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Mail, Phone } from "lucide-react";
import { StateBadge } from "@/components/platform/state-badge";
import { StudioActions } from "@/components/platform/studio-actions";
import { StatusBadge } from "@/components/status-badge";
import { SmartImage } from "@/components/smart-image";
import { AUDIT_LABEL, requirePlatformAdmin, studioState, type PlatformStudioDetail } from "@/lib/platform";
import { formatInTz } from "@/lib/datetime";
import { formatPhone, formatPrice, telHref } from "@/lib/format";
import { SITE_URL } from "@/lib/config";

export const metadata = { title: "Студия" };

const ROLE: Record<string, string> = { owner: "Владелец", admin: "Администратор", staff: "Сотрудник" };

export default async function PlatformStudio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requirePlatformAdmin();
  const { data, error } = await supabase.rpc("platform_studio", { p_id: id });
  if (error || !data) notFound();
  const d = data as PlatformStudioDetail;
  const s = d.studio;
  const state = studioState(s);
  const url = `${SITE_URL}/s/${s.slug}`;
  const tz = s.timezone;
  const counts = [
    ["Услуг", d.counts.services],
    [s.vertical === "auto" ? "Боксов" : "Специалистов", d.counts.staff],
    ["Клиентов", d.counts.clients],
    ["Записей всего", d.counts.appointments],
    ["Записей за 30 дней", d.counts.appointments_30d],
    ["Выручка за 30 дней", formatPrice(d.counts.revenue_30d, s.currency)],
    ["Отзывов", d.counts.reviews],
    ["Фото", d.counts.photos],
  ] as const;

  return (
    <div className="max-w-5xl">
      <Link href="/platform/studios" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Все студии
      </Link>

      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-4">
          <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-xl font-semibold">
            {s.logo_url ? <SmartImage src={s.logo_url} alt="" fill sizes="64px" /> : s.name.slice(0, 1)}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-medium">{s.name}</h1>
              <StateBadge state={state} />
            </div>
            <p className="mt-1 text-muted-foreground">{[s.kind, s.city, s.address].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-sm text-subtle">
              Подключена {formatInTz(s.created_at, tz, { day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        <StudioActions id={s.id} state={state} />
      </div>

      {s.suspended_at && (
        <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm">
          Заблокирована {formatInTz(s.suspended_at, tz, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          {s.suspend_reason ? `. Причина: ${s.suspend_reason}` : ""}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 hover:bg-surface">
          /s/{s.slug} <ArrowUpRight className="size-4" />
        </a>
        {s.phone && (
          <a href={telHref(s.phone)} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 hover:bg-surface">
            <Phone className="size-4" /> {formatPhone(s.phone)}
          </a>
        )}
        {s.email && (
          <a href={`mailto:${s.email}`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 hover:bg-surface">
            <Mail className="size-4" /> {s.email}
          </a>
        )}
      </div>
      {state !== "live" && <p className="mt-2 text-xs text-subtle">Страница сейчас не видна клиентам, по ссылке откроется «не найдено».</p>}

      <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
        {counts.map(([label, value]) => (
          <div key={label} className="bg-background p-5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-2xl font-medium tabular">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-xl font-medium">Команда и доступы</h2>
          <ul className="divide-y divide-border border-y border-border">
            {d.members.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-4 py-3.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name ?? "Без имени"}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {m.email ? (
                      <a href={`mailto:${m.email}`} className="hover:text-foreground">
                        {m.email}
                      </a>
                    ) : null}
                    {m.email && m.phone ? " · " : ""}
                    {m.phone ? (
                      <a href={telHref(m.phone)} className="hover:text-foreground">
                        {formatPhone(m.phone)}
                      </a>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-subtle">{ROLE[m.role] ?? m.role}</span>
              </li>
            ))}
          </ul>

          <h2 className="mb-4 mt-12 text-xl font-medium">История действий</h2>
          {d.audit.length ? (
            <ul className="grid gap-3 text-sm">
              {d.audit.map((a, i) => (
                <li key={i} className="rounded-2xl border border-border p-4">
                  <p className="font-medium">{AUDIT_LABEL[a.action] ?? a.action}</p>
                  {a.reason && <p className="mt-1 text-muted-foreground">{a.reason}</p>}
                  <p className="mt-1 text-xs text-subtle">
                    {formatInTz(a.at, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {a.actor ?? a.actor_email ?? "система"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Действий администрации не было.</p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-medium">Последние записи</h2>
          {d.recent.length ? (
            <ul className="divide-y divide-border border-y border-border">
              {d.recent.map((a) => (
                <li key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-3 py-3.5">
                  <span className="min-w-0">
                    <span className="block truncate">{a.service ?? "Услуга"}</span>
                    <span className="block text-sm text-muted-foreground tabular">
                      {formatInTz(a.start_at, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {formatPrice(a.price, s.currency)}
                    </span>
                  </span>
                  <StatusBadge status={a.status} short />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Записей ещё нет.</p>
          )}
        </section>
      </div>
    </div>
  );
}
