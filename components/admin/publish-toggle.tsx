"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setStudioPublished } from "@/actions/admin/studio";

export function PublishToggle({ published, canPublish, suspended }: { published: boolean; canPublish: boolean; suspended: boolean }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  if (suspended) return null;
  const run = (v: boolean) =>
    start(async () => {
      const res = await setStudioPublished(v);
      if (res.ok) {
        toast.success(v ? "Страница опубликована. Отправляйте ссылку клиентам" : "Страница скрыта от клиентов");
        router.refresh();
      } else toast.error(res.error);
    });
  return published ? (
    <Button variant="outline" loading={pending} onClick={() => run(false)}>
      <EyeOff /> Скрыть страницу
    </Button>
  ) : (
    <Button size="lg" loading={pending} disabled={!canPublish} onClick={() => run(true)}>
      <Rocket /> Опубликовать
    </Button>
  );
}
