import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { MessageSquare } from "lucide-react";
import { ReviewsList } from "@/components/studio/reviews-list";
import { EmptyState } from "@/components/empty-state";
import { Stars } from "@/components/rating";
import { getStudioPageData } from "@/lib/data/studio";
import { plural } from "@/lib/utils";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { copyFor } from "@/lib/vertical";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getStudioPageData((await params).slug).catch(() => null);
  return data ? { title: `Отзывы — ${data.studio.name}` } : {};
}

export default async function ReviewsPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getStudioPageData((await params).slug);
  if (!data) notFound();
  const { rating, reviews } = data;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));

  return (
    <main className="container py-10 md:py-16">
      <p className="eyebrow">{data.studio.name}</p>
      <h1 className="mt-3 text-4xl font-semibold md:text-6xl">Отзывы</h1>
      {reviews.length ? (
        <div className="mt-10 grid gap-10 md:grid-cols-[260px_1fr] md:gap-16">
          <aside className="grid content-start gap-4">
            <p className="text-6xl font-medium tabular">{rating.average.toFixed(1)}</p>
            <Stars value={rating.average} />
            <p className="text-sm text-muted-foreground">
              {rating.count} {plural(rating.count, ["отзыв", "отзыва", "отзывов"])} после визита
            </p>
            <ul className="mt-2 grid gap-2 text-sm">
              {dist.map((d) => (
                <li key={d.n} className="grid grid-cols-[16px_1fr_28px] items-center gap-3 text-muted-foreground">
                  <span className="tabular">{d.n}</span>
                  <span className="h-1 overflow-hidden rounded-full bg-surface-2">
                    <span
                      className="block h-full rounded-full bg-foreground/70"
                      style={{ width: `${rating.count ? (d.count / rating.count) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="text-right tabular">{d.count}</span>
                </li>
              ))}
            </ul>
          </aside>
          <ReviewsList reviews={reviews} staff={data.staff} timezone={data.studio.timezone} resourceLabel={copyFor(data.studio.vertical).resource.toLowerCase()} />
        </div>
      ) : (
        <EmptyState
          className="mt-10"
          icon={MessageSquare}
          title="Отзывов пока нет"
          description="Отзыв можно оставить после визита по ссылке из подтверждения записи."
        />
      )}
      <Link href={`/s/${data.studio.slug}/book`} className="mt-12 inline-flex h-14 items-center gap-2.5 rounded-full bg-primary px-9 font-semibold text-primary-foreground transition-transform active:scale-[0.98]">
        Записаться <ArrowUpRight className="size-5" />
      </Link>
    </main>
  );
}
