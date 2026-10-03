import { Clock, MapPin, Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEEKDAY_LONG, isoWeekday, todayKey } from "@/lib/datetime";
import { formatPhone, telHref } from "@/lib/format";
import { routeLink, socialLinks } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { OpeningHours } from "@/lib/data/studio";
import type { Studio } from "@/types";

export function StudioInfo({ studio, hours }: { studio: Studio; hours: OpeningHours[] }) {
  const today = isoWeekday(todayKey(studio.timezone));
  const socials = socialLinks(studio);

  return (
    <div className="grid gap-10 md:grid-cols-[1fr_1fr] md:gap-16">
      <div className="grid content-start gap-8">
        {studio.address && (
          <div className="flex gap-4">
            <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="grid gap-3">
              <p className="text-lg">{studio.address}</p>
              <Button asChild variant="outline" size="sm" className="w-fit">
                <a href={routeLink(studio)} target="_blank" rel="noopener noreferrer">
                  <Navigation /> Построить маршрут
                </a>
              </Button>
            </div>
          </div>
        )}
        {studio.phone && (
          <div className="flex gap-4">
            <Phone className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <a href={telHref(studio.phone)} className="text-lg tabular underline-offset-4 hover:underline">
              {formatPhone(studio.phone)}
            </a>
          </div>
        )}
        {socials.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {socials.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-full border border-border px-4 text-sm text-muted-foreground transition-colors hover:border-subtle hover:text-foreground"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex gap-4">
        <Clock className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <dl className="grid w-full max-w-sm gap-2.5 text-[0.9375rem]">
          {hours.map((h) => (
            <div
              key={h.weekday}
              className={cn("flex justify-between gap-6", h.weekday === today ? "text-foreground" : "text-muted-foreground")}
            >
              <dt className={cn(h.weekday === today && "font-medium")}>
                {WEEKDAY_LONG[h.weekday]}
                {h.weekday === today && <span className="ml-2 text-xs text-subtle">сегодня</span>}
              </dt>
              <dd className="tabular">{h.open ? `${h.open}–${h.close}` : "выходной"}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
