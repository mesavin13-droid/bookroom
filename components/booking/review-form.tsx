"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { submitReview } from "@/actions/booking";
import { cn } from "@/lib/utils";

export function ReviewForm({ token, defaultName }: { token: string; defaultName: string }) {
  const router = useRouter();
  const [rating, setRating] = React.useState(0);
  const [hover, setHover] = React.useState(0);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("rating", String(rating));
        if (!rating) {
          setErrors({ rating: "Поставьте оценку" });
          return;
        }
        startTransition(async () => {
          const res = await submitReview(token, fd);
          if (res.ok) {
            toast.success("Спасибо! Отзыв появится после проверки.");
            router.refresh();
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <Field label="Оценка" error={errors.rating}>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)} role="radiogroup" aria-label="Оценка">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} из 5`}
              onMouseEnter={() => setHover(n)}
              onClick={() => setRating(n)}
              className="grid size-11 place-items-center rounded-full transition-transform active:scale-90"
            >
              <Star className={cn("size-7 transition-colors", n <= (hover || rating) ? "fill-accent text-accent" : "text-subtle")} />
            </button>
          ))}
        </div>
      </Field>
      <Field label="Комментарий" htmlFor="comment" error={errors.comment}>
        <Textarea id="comment" name="comment" rows={4} maxLength={2000} placeholder="Что понравилось, что улучшить" />
      </Field>
      <Field label="Имя" htmlFor="authorName" error={errors.authorName}>
        <Input id="authorName" name="authorName" defaultValue={defaultName} maxLength={80} required />
      </Field>
      <Field label="Фото (необязательно)" htmlFor="photo" hint="JPG, PNG или WebP до 5 МБ">
        <Input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="h-auto py-3 file:mr-3 file:rounded-full file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-foreground" />
      </Field>
      <Button type="submit" size="lg" loading={pending} className="w-fit">
        Отправить отзыв
      </Button>
    </form>
  );
}
