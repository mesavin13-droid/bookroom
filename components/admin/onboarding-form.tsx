"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Car, CircleDot, Droplets, Gem, Hammer, Paintbrush, Scissors, Sparkles, Store, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { studioCreateSchema, type StudioCreateValues } from "@/lib/validations";
import { createStudio } from "@/actions/admin/studio";
import { maskPhone } from "@/lib/phone";
import { cn, slugify } from "@/lib/utils";
import { TIMEZONES } from "@/lib/timezones";

const KINDS = [
  { kind: "Детейлинг-центр", vertical: "auto", icon: Sparkles },
  { kind: "Автосервис / СТО", vertical: "auto", icon: Wrench },
  { kind: "Шиномонтаж", vertical: "auto", icon: CircleDot },
  { kind: "Автомойка", vertical: "auto", icon: Droplets },
  { kind: "Кузовной ремонт", vertical: "auto", icon: Hammer },
  { kind: "Тюнинг и доп. оборудование", vertical: "auto", icon: Car },
  { kind: "Барбершоп", vertical: "beauty", icon: Scissors },
  { kind: "Салон красоты", vertical: "beauty", icon: Paintbrush },
  { kind: "Ногтевая студия", vertical: "beauty", icon: Gem },
  { kind: "Другой бизнес по записи", vertical: "beauty", icon: Store },
] as const;

function guessTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TIMEZONES.some((t) => t.id === tz) ? tz : "Europe/Moscow";
  } catch {
    return "Europe/Moscow";
  }
}

export function OnboardingForm({ defaultName }: { defaultName?: string }) {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const form = useForm<StudioCreateValues>({
    resolver: zodResolver(studioCreateSchema),
    defaultValues: { name: "", slug: "", timezone: "Europe/Moscow", vertical: "auto", kind: "", city: "", address: "", phone: "", ownerName: defaultName ?? "" },
  });
  React.useEffect(() => form.setValue("timezone", guessTimezone()), [form]);
  const e = form.formState.errors;
  const slug = form.watch("slug");
  const kind = form.watch("kind");
  const origin = typeof window === "undefined" ? "" : window.location.host;

  if (step === 1) {
    return (
      <div className="grid gap-6">
        <div>
          <p className="eyebrow">Шаг 1 из 2</p>
          <h2 className="mt-2 text-2xl font-semibold">Чем вы занимаетесь?</h2>
          <p className="mt-1 text-muted-foreground">Подставим нужные слова, категории услуг и график. Всё можно поменять потом.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {KINDS.map((k) => {
            const Icon = k.icon;
            const active = kind === k.kind;
            return (
              <button
                key={k.kind}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  form.setValue("kind", k.kind);
                  form.setValue("vertical", k.vertical);
                  setStep(2);
                }}
                className={cn(
                  "flex min-h-[104px] flex-col justify-between gap-3 rounded-[1.25rem] border p-4 text-left transition-colors duration-150",
                  active ? "border-primary bg-primary/10" : "border-border bg-surface hover:bg-surface-2",
                )}
              >
                <Icon className="size-6 text-primary" aria-hidden />
                <span className="text-[0.9375rem] font-medium leading-snug">{k.kind}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="grid gap-5"
      onSubmit={form.handleSubmit(async (v) => {
        const res = await createStudio(v);
        if (res.ok) {
          toast.success("Студия создана. Осталось несколько шагов до запуска");
          router.push("/admin/setup");
          router.refresh();
        } else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, m]) => form.setError(k as keyof StudioCreateValues, { message: m }));
          toast.error(res.error);
        }
      })}
    >
      <div>
        <button type="button" onClick={() => setStep(1)} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {kind}
        </button>
        <p className="eyebrow">Шаг 2 из 2</p>
        <h2 className="mt-2 text-2xl font-semibold">Как вас найти</h2>
      </div>
      <Field label="Название" htmlFor="o-name" error={e.name?.message}>
        <Input
          id="o-name"
          placeholder="Например, NORD Detailing"
          autoFocus
          {...form.register("name", {
            onChange: (ev) => {
              if (!slugTouched) form.setValue("slug", slugify(ev.target.value).slice(0, 48));
            },
          })}
        />
      </Field>
      <Field label="Адрес вашего приложения" htmlFor="o-slug" error={e.slug?.message} hint={`Ссылка для клиентов: ${origin}/s/${slug || "nazvanie"}`}>
        <Input id="o-slug" autoCapitalize="none" autoCorrect="off" {...form.register("slug", { onChange: () => setSlugTouched(true) })} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Город" htmlFor="o-city" error={e.city?.message}>
          <Input id="o-city" autoComplete="address-level2" {...form.register("city")} />
        </Field>
        <Field label="Часовой пояс" htmlFor="o-tz">
          <NativeSelect id="o-tz" {...form.register("timezone")}>
            {TIMEZONES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field label="Адрес" htmlFor="o-address" error={e.address?.message} hint="Улица и дом, можно добавить позже">
        <Input id="o-address" autoComplete="street-address" {...form.register("address")} />
      </Field>
      <Field label="Телефон для клиентов" htmlFor="o-phone" error={e.phone?.message}>
        <Input
          id="o-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 900 000-00-00"
          {...form.register("phone", { onChange: (ev) => form.setValue("phone", maskPhone(ev.target.value)) })}
        />
      </Field>
      <Field label="Ваше имя" htmlFor="o-owner" error={e.ownerName?.message}>
        <Input id="o-owner" autoComplete="name" {...form.register("ownerName")} />
      </Field>
      <Button type="submit" size="lg" loading={form.formState.isSubmitting}>
        Создать приложение <ArrowRight />
      </Button>
      <p className="text-center text-sm text-subtle">Страница появится у клиентов после публикации. Сначала добавите услуги и график.</p>
    </form>
  );
}
