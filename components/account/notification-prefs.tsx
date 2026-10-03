"use client";

import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { updateNotificationPrefs } from "@/actions/account";

type Prefs = { notifyEmail: boolean; notifySms: boolean; notifyTelegram: boolean };

export function NotificationPrefs({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = React.useState(initial);
  const [, start] = React.useTransition();
  const rows: { key: keyof Prefs; label: string; hint: string }[] = [
    { key: "notifyEmail", label: "Email", hint: "Подтверждения и напоминания на почту" },
    { key: "notifySms", label: "SMS", hint: "Напоминание за день до визита" },
    { key: "notifyTelegram", label: "Telegram", hint: "Сообщения от бота студии" },
  ];
  return (
    <ul className="divide-y divide-border border-y border-border">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center justify-between gap-6 py-4">
          <label htmlFor={r.key} className="grid cursor-pointer gap-0.5">
            <span className="font-medium">{r.label}</span>
            <span className="text-sm text-muted-foreground">{r.hint}</span>
          </label>
          <Switch
            id={r.key}
            checked={prefs[r.key]}
            onCheckedChange={(checked) => {
              const nextPrefs = { ...prefs, [r.key]: checked };
              setPrefs(nextPrefs);
              start(async () => {
                const res = await updateNotificationPrefs(nextPrefs);
                if (!res.ok) {
                  setPrefs(prefs);
                  toast.error(res.error);
                }
              });
            }}
          />
        </li>
      ))}
    </ul>
  );
}
