import type { Metadata } from "next";
import { AdminMobileBar, AdminSidebar } from "@/components/admin/admin-nav";
import { getAdminContext, isManager } from "@/lib/admin/context";
import Link from "next/link";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Кабинет студии | ${BRAND.name}`, robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAdminContext();
  let unread = 0;
  if (isManager(ctx.role)) {
    const { count } = await ctx.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("studio_id", ctx.studio.id)
      .eq("audience", "studio")
      .is("read_at", null);
    unread = count ?? 0;
  }
  const { data: platform } = await ctx.supabase.rpc("is_platform_admin");
  const props = {
    platform: platform === true,
    vertical: ctx.studio.vertical ?? "beauty",
    role: ctx.role,
    studio: { id: ctx.studio.id, name: ctx.studio.name, slug: ctx.studio.slug },
    studios: ctx.memberships.map((m) => ({ id: m.studio.id, name: m.studio.name })),
    unread,
  };
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar {...props} />
      <div className="min-w-0 flex-1">
        <AdminMobileBar {...props} />
        {ctx.studio.suspended_at ? (
          <div role="alert" className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm md:px-8">
            <span className="font-medium">Страница заблокирована администрацией платформы.</span>{" "}
            {ctx.studio.suspend_reason && <span className="text-muted-foreground">Причина: {ctx.studio.suspend_reason}. </span>}
            <a href={`mailto:${BRAND.supportEmail}`} className="underline underline-offset-4">Написать в поддержку</a>
          </div>
        ) : !ctx.studio.is_published && isManager(ctx.role) ? (
          <div className="border-b border-primary/30 bg-primary/10 px-4 py-3 text-sm md:px-8">
            Страница ещё не видна клиентам.{" "}
            <Link href="/admin/setup" className="font-medium underline underline-offset-4">Завершить настройку и опубликовать</Link>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-6 md:px-8 lg:pb-16 lg:pt-10">{children}</main>
      </div>
    </div>
  );
}
