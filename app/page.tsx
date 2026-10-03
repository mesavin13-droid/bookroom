import Link from "next/link";
import { ArrowUpRight, CalendarCheck2, Images, QrCode, Smartphone, Users, Wrench } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { GlowPanel } from "@/components/studio/glow-panel";
import { SmartImage } from "@/components/smart-image";
import { listPublishedStudios } from "@/lib/data/studio";
import { BRAND } from "@/lib/config";

export const revalidate = 300;

const STEPS = [
  { n: "01", title: "Зарегистрируйтесь", text: "Код на почту или по SMS, без паролей и звонков менеджеру." },
  { n: "02", title: "Заполните страницу", text: "Название, логотип, услуги с ценами, боксы или мастера, график и фото работ." },
  { n: "03", title: "Отправьте ссылку", text: "Клиенты записываются сами, вы видите всё в календаре и получаете уведомления." },
];

const FEATURES = [
  { icon: Smartphone, title: "Приложение на телефоне клиента", text: "Страница ставится на экран «Домой» как приложение, с вашей иконкой." },
  { icon: CalendarCheck2, title: "Только реальное свободное время", text: "Учитываем график, перерывы, выходные и занятые боксы. Двойных записей не бывает." },
  { icon: Wrench, title: "Работы на несколько дней", text: "Керамика, кузовной ремонт, полировка: машина занимает бокс столько дней, сколько нужно." },
  { icon: Users, title: "Клиентская база", text: "История визитов, автомобили, заметки, VIP и чёрный список." },
  { icon: Images, title: "Фото работ и отзывы", text: "Галерея с вашими работами и отзывы только от реальных клиентов." },
  { icon: QrCode, title: "Ссылка и QR-код", text: "Для Instagram, VK, Telegram, Яндекс Карт и плакат на ресепшен." },
];

export default async function HomePage() {
  const studios = await listPublishedStudios();

  return (
    <div className="min-h-dvh">
      <header className="container flex h-16 items-center justify-between">
        <BrandMark />
        <nav className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/account">Мои записи</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/admin">Войти в кабинет</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/start">Создать</Link>
          </Button>
        </nav>
      </header>

      <main className="container pb-24">
        <section className="grid gap-10 pb-16 pt-12 md:grid-cols-[1.3fr_1fr] md:items-end md:pt-24">
          <h1 className="animate-fade-up text-[clamp(2.5rem,7vw,5.5rem)] font-semibold leading-[1.02]">
            Своё приложение для записи в детейлинг, СТО и салон
          </h1>
          <div className="grid animate-fade-up gap-6 [animation-delay:80ms]">
            <p className="text-lg text-muted-foreground">
              {BRAND.name} даёт каждому бизнесу свою страницу: услуги, цены, фото работ и реальное свободное время. Вы отправляете ссылку, клиенты записываются сами.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/start">
                  Создать бесплатно <ArrowUpRight />
                </Link>
              </Button>
              {studios[0] && (
                <Button asChild variant="outline" size="lg">
                  <Link href={`/s/${studios.find((s) => s.vertical === "auto")?.slug ?? studios[0].slug}`}>Посмотреть пример</Link>
                </Button>
              )}
            </div>
          </div>
        </section>

        <section aria-labelledby="how" className="hairline pt-10">
          <h2 id="how" className="eyebrow">
            Как это работает
          </h2>
          <ol className="mt-6 grid gap-3 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-[1.75rem] border border-border bg-surface p-6">
                <span className="text-sm text-primary tabular">{s.n}</span>
                <p className="mt-6 text-xl font-semibold">{s.title}</p>
                <p className="mt-2 text-muted-foreground">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features" className="mt-20">
          <h2 id="features" className="text-[2rem] font-semibold md:text-5xl">
            Всё, что нужно для записи
          </h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.title} className="rounded-[1.75rem] border border-border p-6">
                  <Icon className="size-6 text-primary" aria-hidden />
                  <p className="mt-5 text-lg font-semibold">{f.title}</p>
                  <p className="mt-2 text-[0.9375rem] text-muted-foreground">{f.text}</p>
                </li>
              );
            })}
          </ul>
        </section>

        {studios.length > 0 && (
          <section aria-labelledby="studios-title" className="mt-20">
            <div className="flex items-baseline justify-between">
              <h2 id="studios-title" className="text-[2rem] font-semibold md:text-5xl">
                Уже работают
              </h2>
              <span className="text-sm text-subtle tabular">{studios.length}</span>
            </div>
            <ul className="stagger mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {studios.map((s, i) => (
                <li key={s.id} style={{ ["--i" as string]: i }}>
                  <Link href={`/s/${s.slug}`} className="group grid gap-4">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                      <SmartImage
                        src={s.cover_url}
                        alt={s.name}
                        fallbackLabel={s.name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
                      />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-lg font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.kind ?? s.tagline}</p>
                        {s.address && <p className="mt-1 text-sm text-subtle">{s.address}</p>}
                      </div>
                      <ArrowUpRight className="mt-1 size-5 text-muted-foreground transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <GlowPanel className="mt-20 p-8 md:p-12">
          <h2 className="max-w-2xl text-[2rem] font-semibold md:text-5xl">Запустите запись сегодня</h2>
          <p className="mt-3 max-w-lg text-muted-foreground">Регистрация занимает пару минут. Страница появится у клиентов, когда вы её опубликуете.</p>
          <Button asChild size="lg" className="mt-8">
            <Link href="/start">
              Создать приложение <ArrowUpRight />
            </Link>
          </Button>
        </GlowPanel>
      </main>

      <footer className="container flex flex-wrap justify-between gap-4 border-t border-border py-8 text-sm text-muted-foreground">
        <span>{BRAND.name}</span>
        <nav className="flex gap-5">
          <Link href="/privacy" className="hover:text-foreground">Политика данных</Link>
          <a href={`mailto:${BRAND.supportEmail}`} className="hover:text-foreground">Поддержка</a>
        </nav>
      </footer>
    </div>
  );
}
