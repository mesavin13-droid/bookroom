"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { serviceSchema, type ServiceValues } from "@/lib/validations";
import { deleteCategory, deleteService, saveCategory, saveService, setServiceActive } from "@/actions/admin/services";
import type { ServiceCategory, Staff } from "@/types";

function ServiceForm({
  defaults,
  categories,
  staff,
  onDone,
}: {
  defaults: ServiceValues;
  categories: ServiceCategory[];
  staff: Staff[];
  onDone: () => void;
}) {
  const form = useForm<ServiceValues>({ resolver: zodResolver(serviceSchema), defaultValues: defaults });
  const e = form.formState.errors;
  const staffIds = form.watch("staffIds");
  const days = form.watch("durationDays");
  return (
    <form
      noValidate
      className="grid gap-5 pb-4"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await saveService(v);
        if (res.ok) {
          toast.success(defaults.id ? "Услуга обновлена" : "Услуга создана");
          onDone();
        } else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof ServiceValues, { message: m }));
          toast.error(res.error);
        }
      })}
    >
      <Field label="Название" htmlFor="sv-name" error={e.name?.message}>
        <Input id="sv-name" {...form.register("name")} />
      </Field>
      <Field label="Описание" htmlFor="sv-desc" error={e.description?.message}>
        <Textarea id="sv-desc" rows={3} {...form.register("description")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Цена, ₽" htmlFor="sv-price" error={e.price?.message}>
          <Input id="sv-price" type="number" inputMode="decimal" min={0} step={50} {...form.register("price", { valueAsNumber: true })} />
        </Field>
        {days ? (
          <Field label="Длительность, рабочих дней" htmlFor="sv-days" error={e.durationDays?.message}>
            <Input id="sv-days" type="number" inputMode="numeric" min={1} max={14} {...form.register("durationDays", { valueAsNumber: true })} />
          </Field>
        ) : (
          <Field label="Длительность, мин" htmlFor="sv-dur" error={e.durationMinutes?.message}>
            <Input id="sv-dur" type="number" inputMode="numeric" min={5} step={5} {...form.register("durationMinutes", { valueAsNumber: true })} />
          </Field>
        )}
      </div>
      <div className="grid gap-2">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium">Цена «от»</span>
            <span className="block text-xs text-muted-foreground">Итоговая стоимость после осмотра</span>
          </span>
          <Switch checked={form.watch("priceFrom")} onCheckedChange={(v) => form.setValue("priceFrom", v)} />
        </label>
        <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
          <span>
            <span className="block text-sm font-medium">Длительность в днях</span>
            <span className="block text-xs text-muted-foreground">Занимает ресурс с открытия на N рабочих дней</span>
          </span>
          <Switch checked={Boolean(days)} onCheckedChange={(v) => form.setValue("durationDays", v ? 1 : null)} />
        </label>
      </div>
      <Field label="Категория" htmlFor="sv-cat">
        <NativeSelect id="sv-cat" {...form.register("categoryId")}>
          <option value="">Без категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-[0.8125rem] font-medium text-muted-foreground">Кто оказывает</legend>
        {staff.map((s) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 hover:bg-surface-2">
            <Checkbox
              checked={staffIds.includes(s.id)}
              onChange={(ev) =>
                form.setValue("staffIds", ev.target.checked ? [...staffIds, s.id] : staffIds.filter((x) => x !== s.id))
              }
            />
            <span className="text-sm">{s.name}</span>
          </label>
        ))}
        {!staff.length && <p className="text-sm text-subtle">Добавьте специалистов, чтобы услуга появилась в записи.</p>}
      </fieldset>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
        <span className="text-sm font-medium">Показывать клиентам</span>
        <Switch checked={form.watch("isActive")} onCheckedChange={(v) => form.setValue("isActive", v)} />
      </label>
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Сохранить
      </Button>
    </form>
  );
}

export function ServiceSheet({
  defaults,
  categories,
  staff,
  trigger,
}: {
  defaults?: ServiceValues;
  categories: ServiceCategory[];
  staff: Staff[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Новая услуга
          </Button>
        )}
      </SheetTrigger>
      <SheetContent title={defaults?.id ? "Изменить услугу" : "Новая услуга"}>
        <ServiceForm
          categories={categories}
          staff={staff}
          defaults={
            defaults ?? { name: "", description: "", categoryId: "", price: 1000, durationMinutes: 60, durationDays: null, priceFrom: false, isActive: true, staffIds: staff.map((s) => s.id) }
          }
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

export function ServiceRowActions({ id, isActive, trigger }: { id: string; isActive: boolean; trigger: React.ReactNode }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [confirm, setConfirm] = React.useState(false);
  return (
    <div className="flex items-center gap-1">
      {trigger}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={isActive ? "Скрыть" : "Показать"}
        title={isActive ? "Скрыть от клиентов" : "Показать клиентам"}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setServiceActive(id, !isActive);
            if (res.ok) router.refresh();
            else toast.error(res.error);
          })
        }
      >
        {isActive ? <EyeOff /> : <Eye />}
      </Button>
      <Button
        variant={confirm ? "destructive" : "ghost"}
        size={confirm ? "sm" : "icon-sm"}
        aria-label="Удалить"
        disabled={pending}
        onClick={() => {
          if (!confirm) return setConfirm(true);
          start(async () => {
            const res = await deleteService(id);
            if (res.ok) {
              toast.success(res.data.archived ? "Услуга удалена, история записей сохранена" : "Услуга удалена");
              router.refresh();
            } else toast.error(res.error);
            setConfirm(false);
          });
        }}
        onBlur={() => setConfirm(false)}
      >
        {confirm ? "Удалить?" : <Trash2 />}
      </Button>
    </div>
  );
}

export function CategoryManager({ categories }: { categories: ServiceCategory[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [pending, start] = React.useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        onOk?.();
        router.refresh();
      } else toast.error(res.error);
    });

  return (
    <div className="grid gap-3">
      <ul className="flex flex-wrap gap-2">
        {categories.map((c) =>
          editing === c.id ? (
            <li key={c.id}>
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => saveCategory({ id: c.id, name: editName }), () => setEditing(null));
                }}
              >
                <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} className="h-9 w-36 rounded-full border border-ring bg-surface px-3 text-sm outline-none" />
                <Button size="sm" type="submit" loading={pending}>
                  OK
                </Button>
                <Button size="icon-sm" variant="ghost" type="button" onClick={() => setEditing(null)} aria-label="Отмена">
                  <X />
                </Button>
              </form>
            </li>
          ) : (
            <li key={c.id} className="group flex h-9 items-center gap-1 rounded-full border border-border pl-4 pr-1 text-sm">
              <button type="button" onClick={() => { setEditing(c.id); setEditName(c.name); }} className="hover:underline">
                {c.name}
              </button>
              <button
                type="button"
                aria-label={`Удалить категорию ${c.name}`}
                onClick={() => run(() => deleteCategory(c.id))}
                className="grid size-7 place-items-center rounded-full text-subtle hover:bg-surface-2 hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ),
        )}
      </ul>
      <form
        className="flex max-w-sm gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) run(() => saveCategory({ name }), () => setName(""));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая категория" className="h-10" maxLength={60} />
        <Button type="submit" variant="secondary" loading={pending}>
          Добавить
        </Button>
      </form>
    </div>
  );
}
