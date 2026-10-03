import { Stars } from "@/components/rating";
import { SmartImage } from "@/components/smart-image";
import { formatInTz } from "@/lib/datetime";
import type { Review } from "@/types";
import type { StaffWithServices } from "@/lib/data/studio";

export function ReviewsList({
  reviews,
  staff,
  timezone,
  resourceLabel = "мастер",
}: {
  reviews: Review[];
  staff: StaffWithServices[];
  timezone: string;
  resourceLabel?: string;
}) {
  return (
    <ul className="grid gap-x-8 md:grid-cols-2">
      {reviews.map((r) => (
        <li key={r.id} className="border-t border-border py-6">
          <div className="flex items-center justify-between gap-4">
            <Stars value={r.rating} />
            <time className="text-xs text-subtle" dateTime={r.created_at}>
              {formatInTz(r.created_at, timezone, { day: "numeric", month: "long", year: "numeric" })}
            </time>
          </div>
          {r.comment && <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed">{r.comment}</p>}
          {r.photo_url && (
            <div className="relative mt-4 aspect-[4/3] w-40 overflow-hidden rounded-xl">
              <SmartImage src={r.photo_url} alt="Фото к отзыву" fill sizes="160px" />
            </div>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {r.author_name}
            {r.staff_id && staff.find((s) => s.id === r.staff_id) ? (
              <span className="text-subtle"> · {resourceLabel} {staff.find((s) => s.id === r.staff_id)!.name}</span>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
