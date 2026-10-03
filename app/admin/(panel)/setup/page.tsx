import Link from "next/link";
import { ArrowUpRight, Check, QrCode } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { PublishToggle } from "@/components/admin/publish-toggle";
import { CopyField } from "@/components/admin/share-link";
import { Button } from "@/components/ui/button";
import { requireManagerPage } from "@/lib/admin/context";
import { getSetupProgress } from "@/lib/admin/setup";
import { SITE_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

export const metadata = { title: "Запуск" };

export default async function SetupPage() {
  const ctx = await requireManagerPage();
  const p = await getSetupProgress(ctx);
  const url = `${SITE_URL}/s/${ctx.studio.slug}`;
  const pct = Math.round((p.done / p.total) * 100);
  const suspended = Boolean(ctx.studio.suspended_at);

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Запуск приложения"
        description={p.published ? "Страница работает, клиенты могут записываться." : "Заполните обязательные пункты и опубликуйте страницу."}
        actions={<PublishToggle published={p.published} canPublish={p.canPublish} suspended={suspended} />}
      />

      <div className="mb-8">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Готово</span>
          <span className="font-medium tabular">{pct}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} />
        </div>
        {!p.canPublish && !p.published && (
          <p className="mt-3 text-sm text-muted-foreground">
            Для публикации осталось: {p.missingRequired.map((m) => m.title.toLowerCase()).join(", ")}.
          </p>
        )}
      </div>

      <ol className="grid gap-2">
        {p.steps.map((s, i) => (
          <li key={s.id}>
            <Link
              href={s.href}
              className="group flex items-center gap-4 rounded-[1.25rem] border border-border bg-surface px-4 py-4 transition-colors hover:bg-surface-2"
            >
              <span
                className={cn(
                  "grid size-9 shrink-0 place-items-center rounded-full border text-sm font-semibold tabular",
                  s.done ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                )}
              >
                {s.done ? <Check className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {s.title}
                  {!s.required && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-normal text-muted-foreground">по желанию</span>}
                </span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{s.hint}</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>

      <section className="mt-12 grid gap-4 rounded-[1.75rem] border border-border p-6">
        <h2 className="text-xl font-semibold">Ссылка для клиентов</h2>
        <CopyField value={url} />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/share">
              <QrCode /> QR-код и рассылка
            </Link>
          </Button>
          {p.published && (
            <Button asChild variant="ghost">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Открыть страницу <ArrowUpRight />
              </a>
            </Button>
          )}
        </div>
        {!p.published && <p className="text-sm text-subtle">Пока страница не опубликована, по ссылке клиенты увидят «страница не найдена».</p>}
      </section>
    </div>
  );
}
