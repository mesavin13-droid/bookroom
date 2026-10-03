import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand";

export default function StudioNotFound() {
  return (
    <main className="container flex min-h-dvh flex-col justify-between py-8">
      <BrandMark />
      <div className="max-w-xl animate-fade-up py-16">
        <p className="eyebrow">404</p>
        <h1 className="mt-4 text-5xl font-medium md:text-7xl">Страница не найдена</h1>
        <p className="mt-5 text-lg text-muted-foreground">
          Такой студии, услуги или записи нет. Возможно, адрес изменился.
        </p>
        <div className="mt-10">
          <Button asChild size="lg">
            <Link href="/">Вернуться в студию</Link>
          </Button>
        </div>
      </div>
      <span />
    </main>
  );
}
