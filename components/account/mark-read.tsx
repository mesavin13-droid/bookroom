"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markMyNotificationsRead } from "@/actions/account";

export function MarkReadButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await markMyNotificationsRead();
          if (!res.ok) toast.error(res.error);
        })
      }
    >
      Прочитать все
    </Button>
  );
}
