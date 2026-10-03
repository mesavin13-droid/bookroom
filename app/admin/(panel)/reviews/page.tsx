import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { ReviewActions } from "@/components/admin/review-actions";
import { EmptyState } from "@/components/empty-state";
import { Stars } from "@/components/rating";
import { SmartImage } from "@/components/smart-image";
import { Badge } from "@/components/ui/badge";
import { requireManagerPage } from "@/lib/admin/context";
import { formatInTz } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { Review, ReviewStatus } from "@/types";

const TABS: { id: ReviewStatus | "all"; label: string }[] = [
  { id: "pending", label: "На модерации" },
  { id: "published", label: "Опубликованы" },
  { id: "hidden", label: "Скрыты" },
  { id: "all", label: "Все" },
];
const BADGE = { pending: <Badge variant="warning">На модерации</Badge>, published: <Badge variant="success">Опубликован</Badge>, hidden: <Badge variant="muted">Скрыт</Badge> };

export default async function ReviewsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const ctx = await requireManagerPage();
  const sp = await searchParams;
  const tab = TABS.find((t) => t.id === sp.status)?.id ?? "pending";
  let q = ctx.supabase
    .from("reviews")
    .select("*, staff:staff(name)")
    .eq("studio_id", ctx.studio.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (tab !== "all") q = q.eq("status", tab);
  const { data } = await q;
  const reviews = (data ?? []) as (Review & { staff: { name: string } | null })[];

  return (
    <div className="max-w-4xl">
      <PageHeader title="Отзывы" description="Новые отзывы появляются на странице студии только после публикации." />
      <div className="no-scrollbar -mx-4 mb-6 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
        {TABS.map((t) => (
          <Link key={t.id} href={`/admin/reviews?status=${t.id}`} className={cn("h-9 shrink-0 rounded-full px-4 text-sm leading-9", tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface")}>
            {t.label}
          </Link>
        ))}
      </div>
      {reviews.length ? (
        <ul className="grid gap-3">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Stars value={r.rating} />
                <span className="font-medium">{r.author_name}</span>
                {r.staff && <span className="text-sm text-muted-foreground">о мастере {r.staff.name}</span>}
                <span className="ml-auto">{BADGE[r.status]}</span>
              </div>
              {r.comment && <p className="mt-3 max-w-[70ch] text-[0.9375rem]">{r.comment}</p>}
              {r.photo_url && (
                <div className="relative mt-3 aspect-[4/3] w-40 overflow-hidden rounded-xl">
                  <SmartImage src={r.photo_url} alt="Фото к отзыву" fill sizes="160px" />
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <time className="text-xs text-subtle">{formatInTz(r.created_at, ctx.studio.timezone, { day: "numeric", month: "long", year: "numeric" })}</time>
                <ReviewActions id={r.id} status={r.status} />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={MessageSquare} title="Здесь пусто" description="Клиенты оставляют отзыв по ссылке из подтверждения после визита." />
      )}
    </div>
  );
}
