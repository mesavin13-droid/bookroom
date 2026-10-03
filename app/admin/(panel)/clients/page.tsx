import Link from "next/link";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ClientSheet } from "@/components/admin/client-form";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireManagerPage } from "@/lib/admin/context";
import { formatInTz } from "@/lib/datetime";
import { formatPhone, formatPrice } from "@/lib/format";
import type { Client } from "@/types";

const STATUS = { active: null, vip: <Badge variant="inverse">VIP</Badge>, blocked: <Badge variant="destructive">Заблокирован</Badge> };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const ctx = await requireManagerPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE = 50;

  let query = ctx.supabase.from("clients").select("*", { count: "exact" }).eq("studio_id", ctx.studio.id).order("created_at", { ascending: false });
  if (q) {
    const digits = q.replace(/\D/g, "");
    const safe = q.replace(/[%,()]/g, " ");
    query = digits.length >= 3 ? query.or(`name.ilike.%${safe}%,phone.ilike.%${digits}%`) : query.ilike("name", `%${safe}%`);
  }
  const { data, count, error } = await query.range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw new Error(error.message);
  const clients = (data ?? []) as Client[];
  const { data: stats } = clients.length
    ? await ctx.supabase.from("client_stats").select("*").in("client_id", clients.map((c) => c.id))
    : { data: [] };
  const statOf = (id: string) =>
    (stats ?? []).find((s: { client_id: string }) => s.client_id === id) as
      | { visits: number; last_appointment_at: string | null; total_spent: number }
      | undefined;
  const pages = Math.ceil((count ?? 0) / PAGE);

  return (
    <div>
      <PageHeader title="Клиенты" description={`${count ?? 0} в базе`} actions={<ClientSheet />} />
      <form className="relative mb-6 max-w-md" role="search">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Имя или телефон"
          className="h-11 w-full rounded-full border border-border bg-surface pl-11 pr-4 text-sm outline-none focus:border-ring"
        />
      </form>

      {clients.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="hidden bg-surface text-left text-xs text-subtle md:table-header-group">
              <tr>
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Телефон</th>
                <th className="px-4 py-3 text-right font-medium">Визиты</th>
                <th className="px-4 py-3 font-medium">Последняя запись</th>
                <th className="px-4 py-3 text-right font-medium">Сумма</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => {
                const s = statOf(c.id);
                return (
                  <tr key={c.id} className="relative grid grid-cols-[1fr_auto] gap-1 px-4 py-4 hover:bg-surface/60 md:table-row md:p-0">
                    <td className="font-medium md:px-4 md:py-3.5">
                      <Link href={`/admin/clients/${c.id}`} className="after:absolute after:inset-0">
                        {c.name}
                      </Link>
                    </td>
                    <td className="col-start-1 text-muted-foreground tabular md:px-4 md:py-3.5">{formatPhone(c.phone)}</td>
                    <td className="col-start-2 row-start-1 text-right tabular md:px-4 md:py-3.5">
                      {s?.visits ?? 0}
                      <span className="text-subtle md:hidden"> виз.</span>
                    </td>
                    <td className="hidden text-muted-foreground md:table-cell md:px-4 md:py-3.5">
                      {s?.last_appointment_at ? formatInTz(s.last_appointment_at, ctx.studio.timezone, { day: "numeric", month: "short", year: "numeric" }) : "Нет"}
                    </td>
                    <td className="col-start-2 row-start-2 text-right tabular md:px-4 md:py-3.5">{formatPrice(s?.total_spent ?? 0, ctx.studio.currency)}</td>
                    <td className="hidden md:table-cell md:px-4 md:py-3.5">{STATUS[c.status] ?? <span className="text-subtle">Обычный</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={Users} title={q ? "Никого не нашли" : "Клиентов пока нет"} description={q ? "Попробуйте другой запрос." : "Клиенты появляются автоматически после первой записи."} />
      )}

      {pages > 1 && (
        <nav className="mt-6 flex items-center justify-between text-sm">
          {page > 1 ? <Link href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page - 1}`} className="text-muted-foreground hover:text-foreground">← Назад</Link> : <span />}
          <span className="text-subtle tabular">{page} / {pages}</span>
          {page < pages ? <Link href={`/admin/clients?q=${encodeURIComponent(q)}&page=${page + 1}`} className="text-muted-foreground hover:text-foreground">Дальше →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
