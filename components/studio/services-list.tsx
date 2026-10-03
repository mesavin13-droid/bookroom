"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatServiceDuration, formatServicePrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Service, ServiceCategory } from "@/types";

export function ServicesList({
  slug,
  services,
  categories,
  currency,
  limit,
  withDescription = false,
}: {
  slug: string;
  services: Service[];
  categories: ServiceCategory[];
  currency: string;
  limit?: number;
  withDescription?: boolean;
}) {
  const used = categories.filter((c) => services.some((s) => s.category_id === c.id));
  const [active, setActive] = React.useState<string>("all");
  const filtered = active === "all" ? services : services.filter((s) => s.category_id === active);
  const visible = limit ? filtered.slice(0, limit) : filtered;

  return (
    <div>
      {used.length > 1 && !limit && (
        <div role="tablist" aria-label="Категории" className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 md:mx-0 md:px-0">
          {[{ id: "all", name: "Все" }, ...used].map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={active === c.id}
              onClick={() => setActive(c.id)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 text-sm transition-colors duration-150",
                active === c.id ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <ul className="rounded-[1.75rem] border border-border bg-surface p-2">
        {visible.map((s) => (
          <li key={s.id}>
            <Link
              href={`/s/${slug}/book?service=${s.id}`}
              className="group flex items-center gap-4 rounded-[1.25rem] border border-transparent px-4 py-4 transition-colors duration-200 hover:border-border hover:bg-surface-2 md:py-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[1.0625rem] font-medium">{s.name}</span>
                <span className="mt-0.5 block text-[0.9375rem] text-muted-foreground">
                  {formatServiceDuration(s)}
                  {withDescription && s.description ? ` · ${s.description}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="block whitespace-nowrap font-semibold tabular">{formatServicePrice(s.price, currency, s.price_from)}</span>
                <span className="block text-sm text-muted-foreground">Выбрать</span>
              </span>
              <ArrowUpRight className="size-5 shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
