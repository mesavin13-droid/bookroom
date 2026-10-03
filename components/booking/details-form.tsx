"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";
import { bookingDetailsSchema, type BookingDetailsValues } from "@/lib/validations";
import { maskPhone } from "@/lib/phone";

export const DETAILS_FORM_ID = "booking-details";

export function DetailsForm({
  defaults,
  onSubmit,
  serverError,
  requireVehicle = false,
}: {
  defaults: Partial<BookingDetailsValues>;
  onSubmit: (values: BookingDetailsValues) => Promise<void>;
  serverError?: string | null;
  requireVehicle?: boolean;
}) {
  const schema = React.useMemo(
    () =>
      requireVehicle
        ? bookingDetailsSchema.refine((v) => Boolean(v.vehicleModel?.trim()), { path: ["vehicleModel"], message: "Укажите марку и модель" })
        : bookingDetailsSchema,
    [requireVehicle],
  );
  const [showExtra, setShowExtra] = React.useState(Boolean(defaults.email));
  const form = useForm<BookingDetailsValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", phone: "", email: "", notes: "", vehicleModel: "", vehiclePlate: "", consent: false, ...defaults },
    mode: "onTouched",
  });
  const { register, formState, setValue } = form;
  const e = formState.errors;
  const phoneReg = register("phone");

  return (
    <form id={DETAILS_FORM_ID} noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5">
      <Field label="Имя" htmlFor="name" error={e.name?.message}>
        <Input id="name" autoComplete="name" placeholder="Как к вам обращаться" aria-invalid={!!e.name} {...register("name")} />
      </Field>
      <Field label="Телефон" htmlFor="phone" error={e.phone?.message} hint="Позвоним или напишем, только если что-то изменится">
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+7 900 000-00-00"
          aria-invalid={!!e.phone}
          {...phoneReg}
          onChange={(ev) => {
            setValue("phone", maskPhone(ev.target.value), { shouldValidate: formState.isSubmitted });
          }}
        />
      </Field>

      {requireVehicle && (
        <div className="grid grid-cols-[1.3fr_1fr] gap-3">
          <Field label="Марка и модель" htmlFor="vehicleModel" error={e.vehicleModel?.message}>
            <Input id="vehicleModel" autoComplete="off" placeholder="Toyota Camry" aria-invalid={!!e.vehicleModel} {...register("vehicleModel")} />
          </Field>
          <Field label="Госномер" htmlFor="vehiclePlate" error={e.vehiclePlate?.message}>
            <Input id="vehiclePlate" autoComplete="off" placeholder="А123ВС 777" className="uppercase" {...register("vehiclePlate")} />
          </Field>
        </div>
      )}

      {showExtra ? (
        <>
          <Field label="Email (необязательно)" htmlFor="email" error={e.email?.message}>
            <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />
          </Field>
          <Field label="Комментарий (необязательно)" htmlFor="notes" error={e.notes?.message}>
            <Textarea id="notes" rows={3} placeholder="Например, хочу оставить длину" {...register("notes")} />
          </Field>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setShowExtra(true)}
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          + Email и комментарий
        </button>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-muted-foreground">
        <Checkbox {...register("consent")} aria-invalid={!!e.consent} className="mt-0.5" />
        <span>
          Согласен(на) на обработку персональных данных согласно{" "}
          <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-4">
            политике конфиденциальности
          </Link>
        </span>
      </label>
      {e.consent && <p className="-mt-3 text-[0.8125rem] text-destructive">{e.consent.message}</p>}

      {serverError && (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {serverError}
        </p>
      )}
    </form>
  );
}
