import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = {
  title: `Создать приложение для записи | ${BRAND.name}`,
  description: "Регистрация владельца: своя страница записи для детейлинга, СТО, шиномонтажа, салона или барбершопа.",
};
export const dynamic = "force-dynamic";

const POINTS = [
  "Своя страница с логотипом, фото работ и ценами",
  "Клиенты сами выбирают услугу, бокс и свободное время",
  "Календарь, клиенты и уведомления в кабинете",
  "Ссылка и QR-код для Instagram, VK, карт и ресепшена",
];

export default async function StartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/admin/onboarding");

  return (
    <main className="container flex min-h-dvh flex-col py-6">
      <BrandMark />
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 py-12 md:grid-cols-[1.1fr_1fr]">
        <section>
          <p className="eyebrow">Для владельцев</p>
          <h1 className="mt-4 text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.05]">Приложение для записи в ваш бизнес за 10 минут</h1>
          <ul className="mt-8 grid gap-3">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-[1.0625rem]">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3.5" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-[1.75rem] border border-border bg-surface p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Регистрация</h2>
          <p className="mt-2 text-muted-foreground">Без пароля: пришлём код на почту или по SMS. Уже есть аккаунт? Тот же код, вход и регистрация одинаковые.</p>
          <div className="mt-8">
            <Suspense>
              <LoginForm defaultNext="/admin/onboarding" />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
