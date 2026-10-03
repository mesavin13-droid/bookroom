"use client";

import * as React from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalRouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [offline, setOffline] = React.useState(false);
  React.useEffect(() => {
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    console.error(error);
  }, [error]);

  return (
    <main className="container flex min-h-[70dvh] items-center py-16">
      <div className="max-w-lg animate-fade-up">
        <p className="eyebrow">{offline ? "Нет соединения" : "Ошибка сервера"}</p>
        <h1 className="mt-4 text-4xl font-medium md:text-5xl">
          {offline ? "Похоже, пропал интернет" : "Не получилось загрузить страницу"}
        </h1>
        <p className="mt-4 text-muted-foreground">
          {offline
            ? "Проверьте подключение к сети и попробуйте снова."
            : "Мы уже знаем о проблеме. Попробуйте обновить страницу через несколько секунд."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset} size="lg">
            <RotateCw /> Попробовать снова
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">На главную</Link>
          </Button>
        </div>
        {error.digest && <p className="mt-6 text-xs text-subtle">Код ошибки: {error.digest}</p>}
      </div>
    </main>
  );
}
