import Link from "next/link";
import { Bell } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { MarkStudioReadButton } from "@/components/admin/mark-studio-read";
import { EmptyState } from "@/components/empty-state";
import { requireManagerPage } from "@/lib/admin/context";
import { formatInTz } from "@/lib/datetime";
import type { Notification } from "@/types";

export default async function NotificationsPage() {
  const ctx = await requireManagerPage();
  const { data } = await ctx.supabase
    .from("notifications")
    .select("*")
    .eq("studio_id", ctx.studio.id)
    .eq("audience", "studio")
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <div className="max-w-3xl">
      <PageHeader title="Уведомления" description={unread ? `${unread} непрочитанных` : "Всё прочитано"} actions={unread > 0 && <MarkStudioReadButton />} />
      {items.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {items.map((n) => (
            <li key={n.id}>
              {(() => {
                const body = (<>
                <span aria-hidden className={`mt-2 size-1.5 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <p className={n.read_at ? "text-muted-foreground" : "font-medium"}>{n.title}</p>
                  {n.body && <p className="truncate text-sm text-muted-foreground">{n.body}</p>}
                </div>
                <time className="shrink-0 text-xs text-subtle tabular">
                  {formatInTz(n.created_at, ctx.studio.timezone, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </>);
                return n.appointment_id ? (
                  <Link href={`/admin/appointments/${n.appointment_id}`} className="flex items-start gap-3 py-4 hover:bg-surface/60">{body}</Link>
                ) : (
                  <div className="flex items-start gap-3 py-4">{body}</div>
                );
              })()}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Bell} title="Уведомлений нет" description="Новые записи, отмены и переносы появятся здесь." />
      )}
    </div>
  );
}
