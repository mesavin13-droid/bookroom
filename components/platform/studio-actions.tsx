"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, ShieldBan, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { setStudioStatus } from "@/actions/platform";

export function StudioActions({ id, state }: { id: string; state: "live" | "draft" | "suspended" }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [suspending, setSuspending] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const run = (action: "suspend" | "restore" | "unpublish") =>
    start(async () => {
      const res = await setStudioStatus({ id, action, reason: reason.trim() || undefined });
      if (res.ok) {
        toast.success(action === "suspend" ? "Студия заблокирована" : action === "restore" ? "Студия разблокирована и снова видна клиентам" : "Страница снята с публикации");
        setSuspending(false);
        setReason("");
        router.refresh();
      } else toast.error(res.error);
    });

  if (state === "suspended") {
    return (
      <Button loading={pending} onClick={() => run("restore")}>
        <ShieldCheck /> Разблокировать
      </Button>
    );
  }

  if (suspending) {
    return (
      <div className="grid w-full gap-3 rounded-2xl border border-destructive/40 p-4 sm:w-[380px]">
        <p className="font-medium">Причина блокировки</p>
        <Textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Её увидит владелец в своём кабинете" autoFocus />
        <div className="flex gap-2">
          <Button variant="destructive" loading={pending} disabled={!reason.trim()} onClick={() => run("suspend")}>
            Заблокировать
          </Button>
          <Button variant="ghost" disabled={pending} onClick={() => setSuspending(false)}>
            Отмена
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {state === "live" && (
        <Button variant="outline" loading={pending} onClick={() => run("unpublish")}>
          <EyeOff /> Снять с публикации
        </Button>
      )}
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setSuspending(true)}>
        <ShieldBan /> Заблокировать
      </Button>
    </div>
  );
}
