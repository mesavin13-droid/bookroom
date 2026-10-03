import Link from "next/link";
import { SmartImage } from "@/components/smart-image";
import type { Service } from "@/types";
import type { StaffWithServices } from "@/lib/data/studio";

export function StaffGrid({
  slug,
  staff,
  services,
  layout = "scroll",
}: {
  slug: string;
  staff: StaffWithServices[];
  services: Service[];
  layout?: "scroll" | "grid";
}) {
  const nameOf = (id: string) => services.find((s) => s.id === id)?.name;
  return (
    <ul
      className={
        layout === "scroll"
          ? "no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0"
          : "grid gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {staff.map((m) => (
        <li key={m.id} className={layout === "scroll" ? "w-[78%] shrink-0 snap-start sm:w-[46%] md:w-auto" : undefined}>
          <Link href={`/s/${slug}/book?staff=${m.id}`} className="group grid gap-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface">
              <SmartImage
                src={m.photo_url}
                alt={m.name}
                fallbackLabel={m.name}
                fill
                sizes="(min-width: 768px) 33vw, 80vw"
                className="grayscale-[35%] transition duration-700 ease-out-expo group-hover:scale-[1.03] group-hover:grayscale-0"
              />
            </div>
            <div>
              <p className="eyebrow">{m.position}</p>
              <p className="mt-1.5 text-xl font-medium">{m.name}</p>
              {m.bio && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{m.bio}</p>}
              <p className="mt-3 text-sm text-subtle">
                {m.serviceIds.map(nameOf).filter(Boolean).join(" · ")}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
