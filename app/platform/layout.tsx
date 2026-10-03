import type { Metadata } from "next";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { BrandMark } from "@/components/brand";
import { PlatformNav } from "@/components/platform/platform-nav";
import { requirePlatformAdmin } from "@/lib/platform";
import { signOut } from "@/actions/auth";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: { default: `Платформа | ${BRAND.name}`, template: `%s | Платформа ${BRAND.name}` }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requirePlatformAdmin();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-sticky border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <BrandMark className="text-xs" />
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">Платформа</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email ?? user.phone}</span>
            <Link href="/admin" className="rounded-full px-3 py-2 text-muted-foreground hover:bg-surface hover:text-foreground">
              Мой кабинет студии
            </Link>
            <form action={signOut}>
              <button type="submit" aria-label="Выйти" className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-surface hover:text-foreground">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-[1280px] px-4 pb-3 md:px-8">
          <PlatformNav />
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-8 md:px-8">{children}</main>
    </div>
  );
}
