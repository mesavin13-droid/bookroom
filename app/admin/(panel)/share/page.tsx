import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { CopyField, ShareActions } from "@/components/admin/share-link";
import { QrCode, QrDownloads } from "@/components/qr-code";
import { requireManagerPage } from "@/lib/admin/context";
import { SITE_URL } from "@/lib/config";

export const metadata = { title: "Ссылка и QR" };

export default async function SharePage() {
  const ctx = await requireManagerPage();
  const url = `${SITE_URL}/s/${ctx.studio.slug}`;
  const bookUrl = `${url}/book`;
  const text = `Записывайтесь в ${ctx.studio.name} онлайн`;
  const message = `${text}: выберите услугу и свободное время, подтверждение придёт сразу. ${url}`;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Ссылка и QR" description="Это ваше приложение. Отправьте ссылку клиентам или распечатайте QR-код." />

      {!ctx.studio.is_published && (
        <Link href="/admin/setup" className="mb-8 block rounded-2xl border border-primary/40 bg-primary/10 px-5 py-4 text-sm hover:bg-primary/15">
          Страница ещё не опубликована: по ссылке клиенты её не увидят. <span className="underline underline-offset-4">Перейти к запуску</span>
        </Link>
      )}

      <div className="grid gap-8 md:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-8">
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Главная страница</h2>
            <CopyField value={url} />
            <ShareActions url={url} text={text} />
          </section>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Сразу к записи</h2>
            <p className="text-sm text-muted-foreground">Для кнопки «Записаться» в Instagram, VK, Telegram-канале или на картах.</p>
            <CopyField value={bookUrl} />
          </section>
          <section className="grid gap-3">
            <h2 className="text-lg font-semibold">Готовое сообщение</h2>
            <p className="rounded-2xl border border-border bg-surface p-4 text-[0.9375rem] leading-relaxed">{message}</p>
            <CopyField value={message} label="Скопировать текст сообщения" />
          </section>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-[1.75rem] bg-white p-5">
            <QrCode value={url} className="aspect-square w-full [&_svg]:h-full [&_svg]:w-full" label={`QR-код на ${url}`} />
          </div>
          <p className="text-center text-sm text-muted-foreground">Наведите камеру телефона, чтобы проверить</p>
          <QrDownloads value={url} name={ctx.studio.name} slug={ctx.studio.slug} />
        </aside>
      </div>
    </div>
  );
}
