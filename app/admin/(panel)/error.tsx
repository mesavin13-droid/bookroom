"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid max-w-lg gap-4 py-16">
      <p className="eyebrow">Ошибка</p>
      <h1 className="text-3xl font-medium">Не удалось загрузить раздел</h1>
      <p className="text-muted-foreground">Проверьте соединение и попробуйте ещё раз. Если ошибка повторяется, обновите страницу.</p>
      <Button onClick={reset} className="w-fit">
        <RotateCw /> Повторить
      </Button>
      {error.digest && <p className="text-xs text-subtle">Код: {error.digest}</p>}
    </div>
  );
}
