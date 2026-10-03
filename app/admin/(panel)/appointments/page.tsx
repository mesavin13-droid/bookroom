import Link from "next/link";
import { CalendarPlus, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { getAdminContext, isManager } from "@/lib/admin/context";
import { APPOINTMENT_SELECT, todayRange, type AdminAppointment } from "@/lib/data/admin";
import { formatInTz } from "@/lib/datetime";
import { formatPhone, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/types";

const SCOPES = [
  { id: "upcoming", label: "Предстоящие" },
  { id: "today", label: "Сегодня" },
  { id: "past", label: "Прошедшие" },
  { id: "all", label: "Все" },
] as const;
const STATUSES: (AppointmentStatus | "all")[] = ["all", "pending", "confirmed", "completed", "cancelled", "no_show"];
const STATUS_TAB: Record<string, string> = { all: "Любой статус", pending: "Ожидают", confirmed: "Подтверждены", completed: "Завершены", cancelled: "Отменены", no_show: "Неявки" };

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ scope?: string; status?: string; page?: string }> }) {
  const ctx = await getAdminContext();
  const sp = await searchParams;
  const scope = SCOPES.some((s) => s.id === sp.scope) ? sp.scope! : "upcoming";
  const status = STATUSES.includes(sp.status as AppointmentStatus) ? (sp.status as AppointmentStatus | "all") : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const PAGE = 40;
  const tz = ctx.studio.timezone;
  const now = new Date();

  let q = ctx.supabase.from("appointments").select(APPOINTMENT_SELECT, { count: "exact" }).eq("studio_id", ctx.studio.id);
  if (ctx.role === "staff" && ctx.staffId) q = q.eq("staff_id", ctx.staffId);
  if (scope === "upcoming") q = q.gte("start_at", now.toISOString()).order("start_at");
  else if (scope === "past") q = q.lt("start_at", now.toISOString()).order("start_at", { ascending: false });
  else if (scope === "today") {
    const r = todayRange(ctx);
    q = q.gte("start_at", r.from).lt("start_at", r.to).order("start_at");
  } else q = q.order("start_at", { ascending: false });
  if (status !== "all") q = q.eq("status", status);
  const { data, count, error } = await q.range((page - 1) * PAGE, page * PAGE - 1);
  if (error) throw new Error(error.message);
  const rows = ((data ?? []) as unknown as AdminAppointment[]);
  const pages = Math.ceil((count ?? 0) / PAGE);
  const link = (p: Record<string, string | number>) => {
    const qs = new URLSearchParams({ scope, status, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) });
    return `/admin/appointments?${qs.toString()}`;
  };

  return (
    <div>
      <PageHeader
        title="Записи"
        description={`${count ?? 0} по фильтру`}
        actions={
          isManager(ctx.role) && (
            <Button asChild>
              <Link href="/admin/appointments/new">
                <CalendarPlus /> Новая запись
              </Link>
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-3">
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
          {SCOPES.map((s) => (
            <Link key={s.id} href={link({ scope: s.id, page: 1 })} className={cn("h-9 shrink-0 rounded-full px-4 text-sm leading-9", scope === s.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface")}>
              {s.label}
            </Link>
          ))}
        </div>
        <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
          {STATUSES.map((s) => (
            <Link key={s} href={link({ status: s, page: 1 })} className={cn("h-8 shrink-0 rounded-full border px-3 text-xs leading-[30px]", status === s ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
              {STATUS_TAB[s]}
            </Link>
          ))}
        </div>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="hidden bg-surface text-left text-xs text-subtle md:table-header-group">
              <tr>
                <th className="px-4 py-3 font-medium">Когда</th>
                <th className="px-4 py-3 font-medium">Клиент</th>
                <th className="px-4 py-3 font-medium">Услуга</th>
                <th className="px-4 py-3 font-medium">Специалист</th>
                <th className="px-4 py-3 text-right font-medium">Стоимость</th>
                <th className="px-4 py-3 font-medium">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => (
                <tr key={a.id} className="group relative grid grid-cols-[1fr_auto] gap-1 px-4 py-4 hover:bg-surface/60 md:table-row md:p-0">
                  <td className="md:px-4 md:py-3.5">
                    <Link href={`/admin/appointments/${a.id}`} className="after:absolute after:inset-0">
                      <span className="font-medium tabular">{formatInTz(a.start_at, tz, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    </Link>
                  </td>
                  <td className="col-start-1 md:px-4 md:py-3.5">
                    <span className="block">{a.client?.name}</span>
                    <span className="block text-xs text-subtle tabular">{formatPhone(a.client?.phone)}</span>
                  </td>
                  <td className="col-start-1 text-muted-foreground md:px-4 md:py-3.5 md:text-foreground">{a.service?.name}</td>
                  <td className="hidden md:table-cell md:px-4 md:py-3.5">{a.staff?.name}</td>
                  <td className="col-start-2 row-start-1 text-right tabular md:px-4 md:py-3.5">{formatPrice(a.price, ctx.studio.currency)}</td>
                  <td className="col-start-2 row-start-2 justify-self-end md:px-4 md:py-3.5">
                    <StatusBadge status={a.status} short />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon={ClipboardList} title="Записей нет" description="Измените фильтр или создайте запись вручную." />
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
