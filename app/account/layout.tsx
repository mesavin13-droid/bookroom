import type { Metadata } from "next";
import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { AccountNav } from "@/components/account/account-nav";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/data/account";
import { signOut } from "@/actions/auth";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Личный кабинет | ${BRAND.name}`, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { profile, user, supabase } = await getAccount();
  const { count } = await supabase.from("studio_members").select("studio_id", { count: "exact", head: true }).eq("profile_id", user.id);
  return (
    <div className="min-h-dvh">
      <header className="container flex h-16 items-center justify-between">
        <BrandMark />
        <div className="flex items-center gap-1">
          {(count ?? 0) > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin">Кабинет студии</Link>
            </Button>
          )}
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Выйти
            </Button>
          </form>
        </div>
      </header>
      <div className="container grid gap-8 pb-20 pt-6 md:grid-cols-[200px_1fr] md:gap-14 md:pt-12">
        <aside className="grid content-start gap-6">
          <div>
            <p className="text-lg font-medium">{profile?.full_name ?? "Мой кабинет"}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email ?? (user.phone ? `+${user.phone}` : "")}</p>
          </div>
          <AccountNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
