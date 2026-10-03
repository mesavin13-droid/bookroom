"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { SmartImage } from "@/components/smart-image";

type Item = { id: string; url: string; alt: string | null };

/** Works gallery: tap a photo to open it fullscreen, swipe/arrow through the rest. */
export function Gallery({ items, fallbackAlt }: { items: Item[]; fallbackAlt: string }) {
  const [index, setIndex] = React.useState<number | null>(null);
  const dialog = React.useRef<HTMLDialogElement>(null);
  const touchX = React.useRef<number | null>(null);

  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const close = () => dialog.current?.close();
  const step = React.useCallback(
    (d: number) => setIndex((i) => (i === null ? i : (i + d + items.length) % items.length)),
    [items.length],
  );

  React.useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  const current = index !== null ? items[index] : null;

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {items.map((g, i) => (
          <figure key={g.id} className="grid gap-3">
            <button
              type="button"
              onClick={() => open(i)}
              aria-label={`Открыть фото: ${g.alt ?? fallbackAlt}`}
              className="duotone-wrap group relative aspect-[1.6] overflow-hidden rounded-[1.5rem] border border-border"
            >
              <SmartImage
                src={g.url}
                alt={g.alt ?? fallbackAlt}
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="duotone transition-transform duration-700 ease-out-expo group-hover:scale-[1.03]"
              />
            </button>
            {g.alt && <figcaption className="text-[0.9375rem] text-muted-foreground">{g.alt}</figcaption>}
          </figure>
        ))}
      </div>

      <dialog
        ref={dialog}
        onClose={() => setIndex(null)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-background/95 p-0 text-foreground backdrop:bg-background/80"
      >
        {current && (
          <div
            className="relative grid h-full place-items-center px-4 py-16 animate-in fade-in"
            onClick={(e) => e.target === e.currentTarget && close()}
            onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
            onTouchEnd={(e) => {
              const start = touchX.current;
              const end = e.changedTouches[0]?.clientX;
              if (start != null && end != null && Math.abs(end - start) > 40) step(end < start ? 1 : -1);
              touchX.current = null;
            }}
          >
            <div className="relative aspect-[1.6] w-full max-w-5xl overflow-hidden rounded-[1.5rem]">
              <SmartImage src={current.url} alt={current.alt ?? fallbackAlt} fill sizes="100vw" className="object-contain" />
            </div>
            {current.alt && <p className="absolute inset-x-0 bottom-6 text-center text-[0.9375rem] text-muted-foreground">{current.alt}</p>}
            <button type="button" onClick={close} aria-label="Закрыть" className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-border bg-surface hover:bg-surface-2">
              <X className="size-5" />
            </button>
            {items.length > 1 && (
              <>
                <button type="button" onClick={() => step(-1)} aria-label="Предыдущее фото" className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface hover:bg-surface-2">
                  <ChevronLeft className="size-5" />
                </button>
                <button type="button" onClick={() => step(1)} aria-label="Следующее фото" className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-surface hover:bg-surface-2">
                  <ChevronRight className="size-5" />
                </button>
              </>
            )}
          </div>
        )}
      </dialog>
    </>
  );
}
