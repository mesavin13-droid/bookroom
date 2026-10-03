import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand";
import { OnboardingForm } from "@/components/admin/onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Создать приложение | ${BRAND.name}`, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin/onboarding");
  const [{ count }, { data: profile }] = await Promise.all([
    supabase.from("studio_members").select("studio_id", { count: "exact", head: true }).eq("profile_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  return (
    <main className="container flex min-h-dvh flex-col py-6">
      <BrandMark />
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
        <h1 className="text-4xl font-semibold">Ваше приложение для записи</h1>
        <p className="mt-3 text-muted-foreground">Две минуты на старт, потом услуги, график и фото. Клиенты получат ссылку и запишутся сами.</p>
        <div className="mt-10">
          <OnboardingForm defaultName={(profile as { full_name: string | null } | null)?.full_name ?? undefined} />
        </div>
        {(count ?? 0) > 0 && (
          <Link href="/admin" className="mt-6 text-sm text-muted-foreground hover:text-foreground">
            ← Вернуться в кабинет
          </Link>
        )}
      </div>
    </main>
  );
}
