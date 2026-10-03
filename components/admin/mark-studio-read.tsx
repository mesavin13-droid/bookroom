"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markStudioNotificationsRead } from "@/actions/admin/studio";

export function MarkStudioReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await markStudioNotificationsRead();
          if (res.ok) router.refresh();
          else toast.error(res.error);
        })
      }
    >
      Отметить все прочитанными
    </Button>
  );
}
