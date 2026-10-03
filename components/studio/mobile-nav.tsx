"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck2, House, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

export function StudioMobileNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/s/${slug}`;
  const items = [
    { href: base, label: "Главная", icon: House, exact: true },
    { href: `${base}/services`, label: "Услуги", icon: LayoutGrid },
    { href: `${base}/my`, label: "Моя запись", icon: CalendarCheck2 },
  ];
  return (
    <nav
      aria-label="Навигация"
      className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)] z-nav md:hidden"
    >
      <ul className="grid h-[72px] grid-cols-3 gap-1 rounded-full border border-border bg-background/80 p-1.5 shadow-[0_20px_40px_-12px_oklch(0_0_0/0.7)] backdrop-blur-xl">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 rounded-full text-[0.8125rem] font-medium transition-colors duration-300",
                  active ? "bg-surface-3 text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[22px]" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
