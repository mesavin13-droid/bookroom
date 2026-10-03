"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, LogOut, Menu, ShieldCheck } from "lucide-react";
import { ADMIN_NAV, MOBILE_PRIMARY } from "@/components/admin/nav-items";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { signOut } from "@/actions/auth";
import { switchStudio } from "@/actions/admin/studio";
import { BrandMark } from "@/components/brand";
import { cn } from "@/lib/utils";
import type { StudioRole } from "@/types";

interface Props {
  vertical: "beauty" | "auto";
  role: StudioRole;
  studio: { id: string; name: string; slug: string };
  studios: { id: string; name: string }[];
  unread: number;
  platform?: boolean;
}

function useActive() {
  const pathname = usePathname();
  return (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
}

function StudioSwitcher({ studio, studios }: Pick<Props, "studio" | "studios">) {
  if (studios.length < 2) return <p className="truncate text-sm font-medium">{studio.name}</p>;
  return (
    <form action={switchStudio}>
      <select
        name="studioId"
        defaultValue={studio.id}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="w-full cursor-pointer appearance-none truncate rounded-lg bg-transparent py-1 text-sm font-medium outline-none hover:bg-surface-2"
        aria-label="Студия"
      >
        {studios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </form>
  );
}

function NavList({ role, unread, onNavigate, vertical }: { role: StudioRole; unread: number; onNavigate?: () => void; vertical: Props["vertical"] }) {
  const isActive = useActive();
  return (
    <ul className="grid gap-0.5">
      {ADMIN_NAV.filter((i) => (i.roles as readonly string[]).includes(role)).map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, "exact" in item ? item.exact : false);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-150",
                active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              <span className="flex-1">{item.href === "/admin/staff" && vertical === "auto" ? "Боксы" : item.label}</span>
              {item.href === "/admin/notifications" && unread > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[0.6875rem] font-semibold text-primary-foreground tabular">{unread}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebar(props: Props) {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border px-3 py-5 lg:flex">
      <div className="px-3">
        <BrandMark className="text-xs" />
      </div>
      <div className="mt-6 grid gap-0.5 px-3">
        <p className="eyebrow">Студия</p>
        <StudioSwitcher studio={props.studio} studios={props.studios} />
      </div>
      <nav aria-label="Админ-панель" className="mt-6 flex-1">
        <NavList role={props.role} unread={props.unread} vertical={props.vertical} />
      </nav>
      <div className="grid gap-0.5 border-t border-border pt-3">
        <a
          href={`/s/${props.studio.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <ExternalLink className="size-[18px]" /> Страница студии
        </a>
        {props.platform && (
          <Link href="/platform" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground">
            <ShieldCheck className="size-[18px]" /> Платформа
          </Link>
        )}
        <form action={signOut}>
          <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground hover:bg-surface hover:text-foreground">
            <LogOut className="size-[18px]" /> Выйти
          </button>
        </form>
      </div>
    </aside>
  );
}

export function AdminMobileBar(props: Props) {
  const [open, setOpen] = React.useState(false);
  const isActive = useActive();
  const primary = ADMIN_NAV.filter((i) => MOBILE_PRIMARY.includes(i.href) && (i.roles as readonly string[]).includes(props.role));

  return (
    <>
      <header className="sticky top-0 z-sticky flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-md lg:hidden">
        <div className="min-w-0">
          <StudioSwitcher studio={props.studio} studios={props.studios} />
        </div>
        <Link href="/admin/appointments/new" className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          + Запись
        </Link>
      </header>
      <nav aria-label="Навигация" className="safe-bottom fixed inset-x-0 bottom-0 z-nav border-t border-border bg-background/95 backdrop-blur-md lg:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn("flex h-14 flex-col items-center justify-center gap-1 text-[0.6875rem]", active ? "text-foreground" : "text-subtle")}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className="relative flex h-14 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] text-subtle">
                <Menu className="size-5" aria-hidden />
                Ещё
                {props.unread > 0 && <span className="absolute right-1/4 top-2.5 size-2 rounded-full bg-foreground" />}
              </SheetTrigger>
              <SheetContent title="Меню">
                <NavList role={props.role} unread={props.unread} vertical={props.vertical} onNavigate={() => setOpen(false)} />
                <div className="mt-4 grid gap-1 border-t border-border pt-4">
                  <a href={`/s/${props.studio.slug}`} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-3 px-3 text-sm text-muted-foreground">
                    <ExternalLink className="size-[18px]" /> Страница студии
                  </a>
                  {props.platform && (
                    <Link href="/platform" onClick={() => setOpen(false)} className="flex h-10 items-center gap-3 px-3 text-sm text-muted-foreground">
                      <ShieldCheck className="size-[18px]" /> Платформа
                    </Link>
                  )}
                  <form action={signOut}>
                    <button type="submit" className="flex h-10 items-center gap-3 px-3 text-sm text-muted-foreground">
                      <LogOut className="size-[18px]" /> Выйти
                    </button>
                  </form>
                </div>
              </SheetContent>
            </Sheet>
          </li>
        </ul>
      </nav>
    </>
  );
}
