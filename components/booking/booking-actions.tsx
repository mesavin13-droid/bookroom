"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { cancelBooking } from "@/actions/booking";

export function AddToCalendar({ icsUrl, googleUrl }: { icsUrl: string; googleUrl: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="grid gap-2">
      <Button variant="outline" size="lg" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <CalendarPlus /> Добавить в календарь
      </Button>
      {open && (
        <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
          <Button asChild variant="secondary" size="sm">
            <a href={icsUrl}>Apple / Outlook</a>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={googleUrl} target="_blank" rel="noopener noreferrer">
              Google
            </a>
          </Button>
        </div>
      )}
    </div>
  );
}

export function RescheduleButton({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" size="lg">
      <Link href={href}>
        <CalendarClock /> Перенести
      </Link>
    </Button>
  );
}

export function CancelBooking({ token }: { token: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" size="lg" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
        <X /> Отменить запись
      </Button>
    );
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-destructive/30 p-4 animate-in fade-in">
      <p className="font-medium">Отменить запись?</p>
      <Textarea
        rows={2}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Причина (необязательно)"
        maxLength={300}
      />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await cancelBooking({ token, reason });
              if (res.ok) {
                toast.success("Запись отменена");
                setConfirming(false);
                router.refresh();
              } else {
                toast.error(res.error);
              }
            })
          }
        >
          Да, отменить
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          Оставить
        </Button>
      </div>
    </div>
  );
}
