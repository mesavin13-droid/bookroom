import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/empty-state";
import { StateBadge } from "@/components/platform/state-badge";
import { requirePlatformAdmin, studioState, type PlatformStudioRow } from "@/lib/platform";
import { formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Студии и СТО" };

const TABS = [
  { id: "all", label: "Все" },
  { id: "live", label: "Работают" },
  { id: "draft", label: "Черновики" },
  { id: "suspended", label: "Заблокированы" },
] as const;
const PAGE = 30;

const fmt = (d: string) => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

export default async function PlatformStudios({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; page?: string }> }) {
  const { supabase } = await requirePlatformAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const status = TABS.some((t) => t.id === sp.status) ? sp.status! : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const { data, error } = await supabase.rpc("platform_studios", { p_q: q || null, p_status: status, p_limit: PAGE, p_offset: (page - 1) * PAGE });
  if (error) throw new Error(error.message);
  const { total, items } = data as { total: number; items: PlatformStudioRow[] };
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const link = (p: Record<string, string | number>) => {
    const qs = new URLSearchParams({ ...(q ? { q } : {}), status, page: "1", ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) });
    return `/platform/studios?${qs}`;
  };

  return (
    <div>
      <PageHeader title="Студии и СТО" description={`${total} найдено`} />
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="no-scrollbar flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={link({ status: t.id })}
              className={cn("h-9 shrink-0 rounded-full px-4 text-sm leading-9", status === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative w-full md:max-w-sm" role="search">
          <input type="hidden" name="status" value={status} />
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Название, адрес, email или телефон владельца"
            className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none focus:border-ring"
          />
        </form>
      </div>

      {items.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
          {items.map((s) => (
            <li key={s.id}>
              <Link href={`/platform/studios/${s.id}`} className="grid gap-2 px-4 py-4 transition-colors hover:bg-surface/60 md:grid-cols-[1.4fr_1.2fr_110px_110px_120px] md:items-center md:gap-4">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className="md:hidden">
                      <StateBadge state={studioState(s)} />
                    </span>
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {[s.kind, s.city].filter(Boolean).join(" · ")} · /s/{s.slug}
                  </span>
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block truncate">{s.owner_name ?? "Без имени"}</span>
                  <span className="block truncate text-muted-foreground">{s.owner_email ?? (s.owner_phone ? formatPhone(s.owner_phone) : "контакт не указан")}</span>
                </span>
                <span className="text-sm text-muted-foreground tabular">
                  {s.bookings_30d} <span className="text-subtle">зап./30д</span>
                </span>
                <span className="text-sm text-muted-foreground tabular">{fmt(s.created_at)}</span>
                <span className="hidden justify-self-end md:block">
                  <StateBadge state={studioState(s)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Building2} title={q ? "Ничего не нашли" : "Пока пусто"} description={q ? "Попробуйте другой запрос." : "Здесь появятся студии, как только владельцы зарегистрируются."} />
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={link({ page: page - 1 })} className="text-muted-foreground hover:text-foreground">← Назад</Link> : <span />}
          <span className="text-subtle tabular">{page} / {pages}</span>
          {page < pages ? <Link href={link({ page: page + 1 })} className="text-muted-foreground hover:text-foreground">Дальше →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
