"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteReview, setReviewStatus } from "@/actions/admin/reviews";
import type { ReviewStatus } from "@/types";

export function ReviewActions({ id, status }: { id: string; status: ReviewStatus }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(res.error);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "published" && (
        <Button size="sm" disabled={pending} onClick={() => run(() => setReviewStatus(id, "published"), "Отзыв опубликован")}>
          Опубликовать
        </Button>
      )}
      {status !== "hidden" && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setReviewStatus(id, "hidden"), "Отзыв скрыт")}>
          Скрыть
        </Button>
      )}
      <Button
        size="sm"
        variant={confirm ? "destructive" : "ghost"}
        disabled={pending}
        onClick={() => (confirm ? run(() => deleteReview(id), "Отзыв удалён") : setConfirm(true))}
      >
        {confirm ? "Точно удалить?" : "Удалить"}
      </Button>
    </div>
  );
}
