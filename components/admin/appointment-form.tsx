"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { adminAppointmentSchema, type AdminAppointmentValues } from "@/lib/validations";
import { saveAdminAppointment } from "@/actions/admin/appointments";
import { useAvailability } from "@/hooks/use-availability";
import { maskPhone } from "@/lib/phone";
import { formatDuration } from "@/lib/datetime";
import { formatPhone } from "@/lib/format";
import { STATUS_LABEL } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import type { Service, Staff } from "@/types";

export function AppointmentForm({
  studioSlug,
  services,
  staff,
  links,
  clients,
  defaults,
  showVehicle = false,
}: {
  showVehicle?: boolean;
  studioSlug: string;
  services: Service[];
  staff: Staff[];
  links: { staff_id: string; service_id: string }[];
  clients: { name: string; phone: string }[];
  defaults: AdminAppointmentValues;
}) {
  const router = useRouter();
  const form = useForm<AdminAppointmentValues>({ resolver: zodResolver(adminAppointmentSchema), defaultValues: defaults });
  const { register, setValue, control, formState, setError } = form;
  const e = formState.errors;
  const [serviceId, staffId, date, time, phone] = useWatch({ control, name: ["serviceId", "staffId", "date", "time", "clientPhone"] });

  const eligibleStaff = staff.filter((s) => links.some((l) => l.staff_id === s.id && l.service_id === serviceId));
  const staffList = eligibleStaff.length ? eligibleStaff : staff;
  const service = services.find((s) => s.id === serviceId);

  const { state } = useAvailability({ slug: studioSlug, serviceId: serviceId || null, staffId: staffId || null, admin: true, enabled: Boolean(serviceId && staffId) });
  const daySlots = state.status === "success" ? state.data.days.find((d) => d.date === date)?.slots.filter((s) => s.available) ?? [] : [];

  // Suggest a client when the phone matches an existing one.
  const match = React.useMemo(() => {
    const digits = (phone ?? "").replace(/\D/g, "");
    if (digits.length < 11) return null;
    return clients.find((c) => c.phone.replace(/\D/g, "") === digits) ?? null;
  }, [phone, clients]);

  return (
    <form
      noValidate
      className="grid max-w-2xl gap-6"
      onSubmit={form.handleSubmit(async (values) => {
        const res = await saveAdminAppointment(values);
        if (res.ok) {
          toast.success(defaults.id ? "Запись обновлена" : "Запись создана");
          router.push(`/admin/appointments/${res.data.id}`);
          router.refresh();
        } else {
          Object.entries(res.fieldErrors ?? {}).forEach(([k, v]) => setError(k as keyof AdminAppointmentValues, { message: v }));
          toast.error(res.error);
        }
      })}
    >
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3">Клиент</legend>
        <Field label="Телефон" htmlFor="clientPhone" error={e.clientPhone?.message}>
          <Input
            id="clientPhone"
            type="tel"
            inputMode="tel"
            list="known-clients"
            placeholder="+7 900 000-00-00"
            {...register("clientPhone")}
            onChange={(ev) => setValue("clientPhone", maskPhone(ev.target.value), { shouldValidate: formState.isSubmitted })}
          />
          <datalist id="known-clients">
            {clients.slice(0, 200).map((c) => (
              <option key={c.phone} value={formatPhone(c.phone)}>
                {c.name}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Имя" htmlFor="clientName" error={e.clientName?.message} hint={match ? `В базе: ${match.name}` : undefined}>
          <Input id="clientName" {...register("clientName")} />
        </Field>
        {showVehicle && (
          <>
            <Field label="Марка и модель" htmlFor="vehicleModel" error={e.vehicleModel?.message}>
              <Input id="vehicleModel" placeholder="Toyota Camry" {...register("vehicleModel")} />
            </Field>
            <Field label="Госномер" htmlFor="vehiclePlate" error={e.vehiclePlate?.message}>
              <Input id="vehiclePlate" className="uppercase" placeholder="А123ВС 777" {...register("vehiclePlate")} />
            </Field>
          </>
        )}
        {match && !form.getValues("clientName") && (
          <button type="button" className="-mt-2 w-fit text-sm text-muted-foreground underline underline-offset-4 sm:col-start-2" onClick={() => setValue("clientName", match.name)}>
            Подставить «{match.name}»
          </button>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3">Услуга</legend>
        <Field label="Услуга" htmlFor="serviceId" error={e.serviceId?.message}>
          <NativeSelect
            id="serviceId"
            {...register("serviceId", {
              onChange: (ev) => {
                const s = services.find((x) => x.id === ev.target.value);
                if (s) setValue("price", s.price);
                const ok = links.some((l) => l.service_id === ev.target.value && l.staff_id === form.getValues("staffId"));
                if (!ok) {
                  const first = links.find((l) => l.service_id === ev.target.value);
                  if (first) setValue("staffId", first.staff_id);
                }
              },
            })}
          >
            <option value="" disabled>
              Выберите услугу
            </option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.duration_days ? `${s.duration_days} д` : formatDuration(s.duration_minutes)}
                {!s.is_active ? " (скрыта)" : ""}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Специалист" htmlFor="staffId" error={e.staffId?.message}>
          <NativeSelect id="staffId" {...register("staffId")}>
            <option value="" disabled>
              Выберите специалиста
            </option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3">Время</legend>
        <Field label="Дата" htmlFor="date" error={e.date?.message}>
          <Input id="date" type="date" {...register("date")} />
        </Field>
        <Field label="Время" htmlFor="time" error={e.time?.message} hint={service ? (service.duration_days ? `Займёт ${service.duration_days} раб. дн., начало в открытие` : `Займёт ${formatDuration(service.duration_minutes)}`) : undefined}>
          <Input id="time" type="time" step={300} {...register("time")} />
        </Field>
        {serviceId && staffId && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-[0.8125rem] text-muted-foreground">Свободные окна на эту дату</p>
            {state.status === "loading" ? (
              <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 w-16 animate-pulse rounded-full bg-surface" />)}</div>
            ) : daySlots.length ? (
              <div className="flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <button
                    key={s.startAt}
                    type="button"
                    onClick={() => setValue("time", s.time, { shouldValidate: true })}
                    className={cn(
                      "h-9 rounded-full border px-3.5 text-sm tabular transition-colors",
                      time?.slice(0, 5) === s.time ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-subtle",
                    )}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-subtle">Свободных окон нет. Можно указать время вручную, если специалист согласен.</p>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="eyebrow mb-3">Детали</legend>
        <Field label="Стоимость, ₽" htmlFor="price" error={e.price?.message}>
          <Input id="price" type="number" inputMode="decimal" min={0} step={50} {...register("price", { valueAsNumber: true })} />
        </Field>
        <Field label="Статус" htmlFor="status">
          <NativeSelect id="status" {...register("status")}>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Комментарий" htmlFor="notes" className="sm:col-span-2" error={e.notes?.message}>
          <Textarea id="notes" rows={3} {...register("notes")} />
        </Field>
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" size="lg" loading={formState.isSubmitting}>
          {defaults.id ? "Сохранить изменения" : "Создать запись"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
