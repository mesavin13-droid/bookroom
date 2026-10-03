"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { SmartImage } from "@/components/smart-image";
import {
  bookingSettingsSchema,
  studioProfileSchema,
  type BookingSettingsValues,
  type StudioProfileValues,
} from "@/lib/validations";
import { addGalleryImages, deleteMedia, removeBrandImage, updateBookingSettings, updateStudioProfile, uploadBrandImage } from "@/actions/admin/studio";
import { maskPhone } from "@/lib/phone";
import { TIMEZONES } from "@/lib/timezones";

export function StudioProfileForm({ defaults }: { defaults: StudioProfileValues }) {
  const router = useRouter();
  const form = useForm<StudioProfileValues>({ resolver: zodResolver(studioProfileSchema), defaultValues: defaults });
  const e = form.formState.errors;
  const r = form.register;
  return (
    <form
      noValidate
      className="grid gap-5 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await updateStudioProfile(v);
        if (res.ok) {
          toast.success("Сохранено");
          router.refresh();
        } else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof StudioProfileValues, { message: m }));
          toast.error(res.error);
        }
      })}
    >
      <Field label="Название" htmlFor="st-name" error={e.name?.message}>
        <Input id="st-name" {...r("name")} />
      </Field>
      <Field label="Адрес страницы (slug)" htmlFor="st-slug" error={e.slug?.message} hint="Старые ссылки перестанут работать после смены">
        <Input id="st-slug" {...r("slug")} />
      </Field>
      <Field label="Тип бизнеса" htmlFor="st-vertical" hint="Меняет термины: специалисты или боксы, поля автомобиля в записи">
        <NativeSelect id="st-vertical" {...r("vertical")}>
          <option value="beauty">Салон, барбершоп, студия</option>
          <option value="auto">Детейлинг, автосервис, СТО</option>
        </NativeSelect>
      </Field>
      <Field label="Подпись" htmlFor="st-kind" hint="Например: Studio / Beauty Space">
        <Input id="st-kind" {...r("kind")} />
      </Field>
      <Field label="Короткий слоган" htmlFor="st-tag" error={e.tagline?.message}>
        <Input id="st-tag" {...r("tagline")} />
      </Field>
      <Field label="Описание" htmlFor="st-desc" className="md:col-span-2" error={e.description?.message}>
        <Textarea id="st-desc" rows={4} {...r("description")} />
      </Field>
      <Field label="Адрес" htmlFor="st-addr" className="md:col-span-2">
        <Input id="st-addr" {...r("address")} />
      </Field>
      <Field label="Город" htmlFor="st-city">
        <Input id="st-city" {...r("city")} />
      </Field>
      <Field label="Часовой пояс" htmlFor="st-tz">
        <NativeSelect id="st-tz" {...r("timezone")}>
          {TIMEZONES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Телефон" htmlFor="st-phone" error={e.phone?.message}>
        <Input id="st-phone" type="tel" {...r("phone")} onChange={(ev) => form.setValue("phone", maskPhone(ev.target.value))} />
      </Field>
      <Field label="Email" htmlFor="st-email" error={e.email?.message}>
        <Input id="st-email" type="email" {...r("email")} />
      </Field>
      <Field label="Сайт" htmlFor="st-web" error={e.website?.message}>
        <Input id="st-web" placeholder="https://" {...r("website")} />
      </Field>
      <Field label="Telegram" htmlFor="st-tg">
        <Input id="st-tg" placeholder="username" {...r("telegram")} />
      </Field>
      <Field label="VK" htmlFor="st-vk">
        <Input id="st-vk" placeholder="club или короткое имя" {...r("vk")} />
      </Field>
      <Field label="Instagram" htmlFor="st-ig">
        <Input id="st-ig" placeholder="username" {...r("instagram")} />
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 md:col-span-2">
        <span>
          <span className="block text-sm font-medium">Страница опубликована</span>
          <span className="block text-xs text-muted-foreground">Если выключить, онлайн-запись и страница студии станут недоступны</span>
        </span>
        <Switch checked={form.watch("isPublished")} onCheckedChange={(v) => form.setValue("isPublished", v, { shouldDirty: true })} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          Сохранить
        </Button>
      </div>
    </form>
  );
}

export function BookingSettingsForm({ defaults }: { defaults: BookingSettingsValues }) {
  const router = useRouter();
  const form = useForm<BookingSettingsValues>({ resolver: zodResolver(bookingSettingsSchema), defaultValues: defaults });
  const e = form.formState.errors;
  const num = { valueAsNumber: true } as const;
  return (
    <form
      noValidate
      className="grid gap-5 md:grid-cols-2"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await updateBookingSettings(v);
        if (res.ok) {
          toast.success("Правила записи обновлены");
          router.refresh();
        } else toast.error(res.error);
      })}
    >
      <Field label="Минимум до записи, минут" htmlFor="bs-min" error={e.minNoticeMinutes?.message} hint="120 = за 2 часа">
        <Input id="bs-min" type="number" min={0} step={15} {...form.register("minNoticeMinutes", num)} />
      </Field>
      <Field label="Запись открыта на, дней вперёд" htmlFor="bs-max" error={e.maxAdvanceDays?.message}>
        <Input id="bs-max" type="number" min={1} max={180} {...form.register("maxAdvanceDays", num)} />
      </Field>
      <Field label="Отмена и перенос не позднее, минут" htmlFor="bs-cancel" error={e.cancelNoticeMinutes?.message} hint="180 = за 3 часа до визита">
        <Input id="bs-cancel" type="number" min={0} step={15} {...form.register("cancelNoticeMinutes", num)} />
      </Field>
      <Field label="Шаг сетки времени" htmlFor="bs-step" error={e.slotStepMinutes?.message}>
        <NativeSelect id="bs-step" {...form.register("slotStepMinutes", num)}>
          {[10, 15, 20, 30, 60].map((m) => (
            <option key={m} value={m}>
              {m} минут
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
        <span className="text-sm font-medium">Разрешить перенос онлайн</span>
        <Switch checked={form.watch("allowReschedule")} onCheckedChange={(v) => form.setValue("allowReschedule", v)} />
      </label>
      <label className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
        <span>
          <span className="block text-sm font-medium">Подтверждать автоматически</span>
          <span className="block text-xs text-muted-foreground">Иначе записи ждут вашего подтверждения</span>
        </span>
        <Switch checked={form.watch("autoConfirm")} onCheckedChange={(v) => form.setValue("autoConfirm", v)} />
      </label>
      <div className="md:col-span-2">
        <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
          Сохранить правила
        </Button>
      </div>
    </form>
  );
}

export function BrandImage({ kind, url, label }: { kind: "logo" | "cover"; url: string | null; label: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div className="grid gap-3">
      <p className="text-[0.8125rem] font-medium text-muted-foreground">{label}</p>
      <div className={kind === "logo" ? "relative size-24 overflow-hidden rounded-2xl bg-surface" : "relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-surface"}>
        {url ? <SmartImage src={url} alt={label} fill sizes={kind === "logo" ? "96px" : "600px"} /> : <div className="grid h-full place-items-center text-subtle"><ImagePlus className="size-6" /></div>}
      </div>
      <div className="flex gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("file", file);
            start(async () => {
              const res = await uploadBrandImage(kind, fd);
              if (res.ok) {
                toast.success("Загружено");
                router.refresh();
              } else toast.error(res.error);
              if (input.current) input.current.value = "";
            });
          }}
        />
        <Button type="button" variant="outline" size="sm" loading={pending} onClick={() => input.current?.click()}>
          <Upload /> {url ? "Заменить" : "Загрузить"}
        </Button>
        {url && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await removeBrandImage(kind);
                if (res.ok) router.refresh();
                else toast.error(res.error);
              })
            }
          >
            Убрать
          </Button>
        )}
      </div>
    </div>
  );
}

export function GalleryManager({ items }: { items: { id: string; url: string; alt: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const input = React.useRef<HTMLInputElement>(null);
  return (
    <div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((m) => (
          <li key={m.id} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
            <SmartImage src={m.url} alt={m.alt ?? ""} fill sizes="240px" />
            <button
              type="button"
              aria-label="Удалить фото"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteMedia(m.id);
                  if (res.ok) router.refresh();
                  else toast.error(res.error);
                })
              }
              className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-background/80 text-foreground opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={pending}
            className="grid aspect-[3/4] w-full place-items-center rounded-2xl border border-dashed border-border text-muted-foreground transition-colors hover:border-subtle hover:text-foreground"
          >
            <span className="grid justify-items-center gap-2 text-sm">
              <ImagePlus className="size-6" />
              {pending ? "Загружаем…" : "Добавить фото"}
            </span>
          </button>
        </li>
      </ul>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (!files.length) return;
          const fd = new FormData();
          files.forEach((f) => fd.append("files", f));
          start(async () => {
            const res = await addGalleryImages(fd);
            if (res.ok) {
              toast.success("Фото добавлены");
              router.refresh();
            } else toast.error(res.error);
            if (input.current) input.current.value = "";
          });
        }}
      />
    </div>
  );
}
