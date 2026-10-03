"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { clientSchema, type ClientValues } from "@/lib/validations";
import { deleteClient, saveClient } from "@/actions/admin/clients";
import { maskPhone } from "@/lib/phone";

function ClientForm({ defaults, onDone }: { defaults: ClientValues; onDone: (id: string) => void }) {
  const form = useForm<ClientValues>({ resolver: zodResolver(clientSchema), defaultValues: defaults });
  const e = form.formState.errors;
  return (
    <form
      noValidate
      className="grid gap-5 pb-4"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await saveClient(v);
        if (res.ok) {
          toast.success(defaults.id ? "Клиент обновлён" : "Клиент добавлен");
          onDone(res.data.id);
        } else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ClientValues, { message: m }));
          toast.error(res.error);
        }
      })}
    >
      <Field label="Имя" htmlFor="c-name" error={e.name?.message}>
        <Input id="c-name" {...form.register("name")} />
      </Field>
      <Field label="Телефон" htmlFor="c-phone" error={e.phone?.message}>
        <Input id="c-phone" type="tel" {...form.register("phone")} onChange={(ev) => form.setValue("phone", maskPhone(ev.target.value))} />
      </Field>
      <Field label="Email" htmlFor="c-email" error={e.email?.message}>
        <Input id="c-email" type="email" {...form.register("email")} />
      </Field>
      <Field label="Статус" htmlFor="c-status">
        <NativeSelect id="c-status" {...form.register("status")}>
          <option value="active">Обычный</option>
          <option value="vip">VIP</option>
          <option value="blocked">Заблокирован (без онлайн-записи)</option>
        </NativeSelect>
      </Field>
      <Field label="Заметки" htmlFor="c-notes" hint="Видят только сотрудники студии">
        <Textarea id="c-notes" rows={4} {...form.register("notes")} />
      </Field>
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Сохранить
      </Button>
    </form>
  );
}

export function ClientSheet({ defaults, trigger }: { defaults?: ClientValues; trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Новый клиент
          </Button>
        )}
      </SheetTrigger>
      <SheetContent title={defaults?.id ? "Изменить клиента" : "Новый клиент"}>
        <ClientForm
          defaults={defaults ?? { name: "", phone: "", email: "", notes: "", status: "active" }}
          onDone={(id) => {
            setOpen(false);
            router.push(`/admin/clients/${id}`);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export function DeleteClientButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant={confirm ? "destructive" : "ghost"}
      loading={pending}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        start(async () => {
          const res = await deleteClient(id);
          if (res.ok) {
            toast.success("Клиент удалён");
            router.push("/admin/clients");
          } else {
            toast.error(res.error);
            setConfirm(false);
          }
        });
      }}
    >
      {confirm ? "Точно удалить?" : "Удалить клиента"}
    </Button>
  );
}
