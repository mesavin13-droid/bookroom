"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { SmartImage } from "@/components/smart-image";
import { deleteStaff, saveStaff } from "@/actions/admin/staff";
import type { Service } from "@/types";

export interface StaffFormDefaults {
  id?: string;
  name: string;
  position: string;
  bio: string;
  isActive: boolean;
  photoUrl: string | null;
  serviceIds: string[];
}

export function StaffForm({ defaults, services, onDone }: { defaults: StaffFormDefaults; services: Service[]; onDone?: (id: string) => void }) {
  const router = useRouter();
  const [active, setActive] = React.useState(defaults.isActive);
  const [preview, setPreview] = React.useState<string | null>(defaults.photoUrl);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [pending, start] = React.useTransition();

  return (
    <form
      className="grid gap-5 pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("isActive", String(active));
        if (defaults.id) fd.set("id", defaults.id);
        start(async () => {
          const res = await saveStaff(fd);
          if (res.ok) {
            toast.success(defaults.id ? "Изменения сохранены" : "Специалист добавлен");
            setErrors({});
            if (onDone) onDone(res.data.id);
            else router.refresh();
          } else {
            setErrors(res.fieldErrors ?? {});
            toast.error(res.error);
          }
        });
      }}
    >
      <div className="flex items-center gap-4">
        <label className="group relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-full bg-surface-2">
          <SmartImage src={preview} alt="" fallbackLabel={defaults.name || "?"} fill sizes="80px" unoptimized={preview?.startsWith("blob:")} />
          <span className="absolute inset-0 grid place-items-center bg-background/60 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="size-5" />
          </span>
          <input
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setPreview(URL.createObjectURL(f));
            }}
          />
        </label>
        <p className="text-sm text-muted-foreground">Фото: JPG, PNG или WebP до 5 МБ. Лучше вертикальное.</p>
      </div>
      {errors.photo && <p className="text-sm text-destructive">{errors.photo}</p>}

      <Field label="Имя" htmlFor="s-name" error={errors.name}>
        <Input id="s-name" name="name" defaultValue={defaults.name} required />
      </Field>
      <Field label="Должность" htmlFor="s-pos" error={errors.position}>
        <Input id="s-pos" name="position" defaultValue={defaults.position} placeholder="Барбер, стилист…" />
      </Field>
      <Field label="Коротко о специалисте" htmlFor="s-bio" error={errors.bio}>
        <Textarea id="s-bio" name="bio" rows={3} defaultValue={defaults.bio} />
      </Field>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Услуги</legend>
        {services.length ? (
          services.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 hover:bg-surface-2">
              <Checkbox name="serviceIds" value={s.id} defaultChecked={defaults.serviceIds.includes(s.id)} />
              <span className="flex-1 text-sm">{s.name}</span>
            </label>
          ))
        ) : (
          <p className="text-sm text-subtle">Сначала добавьте услуги.</p>
        )}
      </fieldset>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
        <span>
          <span className="block text-sm font-medium">Принимает онлайн-записи</span>
          <span className="block text-xs text-muted-foreground">Если выключить, специалист скрыт со страницы студии</span>
        </span>
        <Switch checked={active} onCheckedChange={setActive} />
      </label>

      <Button type="submit" size="lg" loading={pending}>
        {defaults.id ? "Сохранить" : "Добавить специалиста"}
      </Button>
    </form>
  );
}

export function NewStaffSheet({ services }: { services: Service[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus /> Добавить специалиста
        </Button>
      </SheetTrigger>
      <SheetContent title="Новый специалист" description="По умолчанию: Пн–Пт 10:00–19:00. Расписание можно изменить сразу после.">
        <StaffForm
          services={services}
          defaults={{ name: "", position: "", bio: "", isActive: true, photoUrl: null, serviceIds: [] }}
          onDone={(id) => {
            setOpen(false);
            router.push(`/admin/staff/${id}`);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export function DeleteStaffButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState(false);
  const [pending, start] = React.useTransition();
  return (
    <Button
      variant={confirm ? "destructive" : "ghost"}
      className={confirm ? "" : "text-destructive"}
      loading={pending}
      onClick={() => {
        if (!confirm) return setConfirm(true);
        start(async () => {
          const res = await deleteStaff(id);
          if (res.ok) {
            toast.success(res.data.archived ? "Специалист удалён, история записей сохранена" : "Специалист удалён");
            router.push("/admin/staff");
            router.refresh();
          } else {
            toast.error(res.error);
            setConfirm(false);
          }
        });
      }}
    >
      {confirm ? "Точно удалить?" : "Удалить специалиста"}
    </Button>
  );
}
