"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Check, CheckCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setAppointmentStatus } from "@/actions/admin/appointments";
import type { AppointmentStatus } from "@/types";

export function AppointmentStatusActions({ id, status }: { id: string; status: AppointmentStatus }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  const set = (next: AppointmentStatus, msg: string) =>
    start(async () => {
      const res = await setAppointmentStatus({ id, status: next });
      if (res.ok) {
        toast.success(msg);
        setConfirmCancel(false);
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <Button onClick={() => set("confirmed", "Запись подтверждена")} loading={pending}>
          <Check /> Подтвердить
        </Button>
      )}
      {(status === "pending" || status === "confirmed") && (
        <>
          <Button variant="secondary" onClick={() => set("completed", "Визит завершён")} disabled={pending}>
            <CheckCheck /> Завершить
          </Button>
          <Button variant="outline" onClick={() => set("no_show", "Отмечена неявка")} disabled={pending}>
            <UserX /> Не пришёл
          </Button>
          {confirmCancel ? (
            <Button variant="destructive" onClick={() => set("cancelled", "Запись отменена")} loading={pending}>
              Точно отменить?
            </Button>
          ) : (
            <Button variant="ghost" className="text-destructive" onClick={() => setConfirmCancel(true)} disabled={pending}>
              <Ban /> Отменить
            </Button>
          )}
        </>
      )}
      {(status === "cancelled" || status === "no_show") && (
        <Button variant="outline" onClick={() => set("confirmed", "Запись восстановлена")} loading={pending}>
          Вернуть в подтверждённые
        </Button>
      )}
    </div>
  );
}
