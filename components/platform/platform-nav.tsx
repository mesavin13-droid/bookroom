"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/platform", label: "Сводка", icon: LayoutDashboard, exact: true },
  { href: "/platform/studios", label: "Студии и СТО", icon: Building2 },
];

export function PlatformNav() {
  const path = usePathname();
  return (
    <nav aria-label="Платформа" className="no-scrollbar flex gap-1 overflow-x-auto">
      {ITEMS.map((i) => {
        const active = i.exact ? path === i.href : path.startsWith(i.href);
        const Icon = i.icon;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors",
              active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden /> {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
