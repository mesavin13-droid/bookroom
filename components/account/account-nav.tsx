"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/account", label: "Обзор", exact: true },
  { href: "/account/appointments", label: "Предстоящие" },
  { href: "/account/history", label: "История" },
  { href: "/account/profile", label: "Профиль" },
  { href: "/account/settings", label: "Настройки" },
];

export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Личный кабинет" className="no-scrollbar -mx-5 flex gap-1 overflow-x-auto px-5 md:mx-0 md:flex-col md:px-0">
      {ITEMS.map((i) => {
        const active = i.exact ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm transition-colors md:rounded-xl",
              active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
