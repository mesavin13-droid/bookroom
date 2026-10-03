"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { profileSchema, type ProfileValues } from "@/lib/validations";
import { updateProfile } from "@/actions/account";
import { maskPhone } from "@/lib/phone";

export function ProfileForm({ defaults, email }: { defaults: ProfileValues; email: string | null }) {
  const form = useForm<ProfileValues>({ resolver: zodResolver(profileSchema), defaultValues: defaults });
  const e = form.formState.errors;
  return (
    <form
      className="grid max-w-md gap-5"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await updateProfile(v);
        if (res.ok) toast.success("Профиль сохранён");
        else toast.error(res.error);
      })}
    >
      <Field label="Имя" htmlFor="fullName" error={e.fullName?.message}>
        <Input id="fullName" autoComplete="name" {...form.register("fullName")} />
      </Field>
      <Field label="Телефон" htmlFor="phone" error={e.phone?.message}>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          {...form.register("phone")}
          onChange={(ev) => form.setValue("phone", maskPhone(ev.target.value))}
        />
      </Field>
      <Field label="Email" hint="Email используется для входа и не меняется здесь">
        <Input value={email ?? "Не указан"} disabled readOnly />
      </Field>
      <Field label="Telegram" htmlFor="tg" error={e.telegramUsername?.message} hint="Для уведомлений, когда студия подключит Telegram">
        <Input id="tg" placeholder="@username" {...form.register("telegramUsername")} />
      </Field>
      <Button type="submit" loading={form.formState.isSubmitting} className="w-fit">
        Сохранить
      </Button>
    </form>
  );
}
