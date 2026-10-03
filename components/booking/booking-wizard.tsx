"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCw, Shuffle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SmartImage } from "@/components/smart-image";
import { DateStrip, MonthCalendar } from "@/components/booking/date-picker";
import { SlotGrid, SlotGridSkeleton } from "@/components/booking/slot-grid";
import { DETAILS_FORM_ID, DetailsForm } from "@/components/booking/details-form";
import { useAvailability } from "@/hooks/use-availability";
import { createBooking, rescheduleBooking } from "@/actions/booking";
import { formatDateKey, formatInTz } from "@/lib/datetime";
import { formatServiceDuration, formatServicePrice } from "@/lib/format";
import { saveBooking } from "@/lib/saved-bookings";
import { copyFor } from "@/lib/vertical";
import { cn } from "@/lib/utils";
import type { Slot } from "@/lib/booking/slots";
import type { BookingDetailsValues } from "@/lib/validations";
import type { Service, ServiceCategory, Studio } from "@/types";
import type { StaffWithServices } from "@/lib/data/studio";

type Step = "service" | "staff" | "datetime" | "details";
const STEPS: Step[] = ["service", "staff", "datetime", "details"];
const STEP_TITLE: Record<Step, string> = {
  service: "Выберите услугу",
  staff: "Выберите специалиста",
  datetime: "Дата и время",
  details: "Ваши данные",
};
const RETRY_CODES = ["SLOT_TAKEN", "SLOT_UNAVAILABLE", "TOO_SOON", "STAFF_UNAVAILABLE", "TOO_FAR"];

export interface WizardProps {
  studio: Pick<Studio, "slug" | "name" | "address" | "currency" | "timezone" | "vertical">;
  services: Service[];
  categories: ServiceCategory[];
  staff: StaffWithServices[];
  initial: { serviceId?: string; staffId?: string; date?: string };
  defaults: Partial<BookingDetailsValues>;
  reschedule?: { token: string; serviceId: string; staffId: string; startAt: string } | null;
}

export function BookingWizard({ studio, services, categories, staff, initial, defaults, reschedule }: WizardProps) {
  const router = useRouter();
  const copy = copyFor(studio.vertical);
  const stepTitle: Record<Step, string> = { ...STEP_TITLE, staff: studio.vertical === "auto" ? "Выберите бокс" : STEP_TITLE.staff };
  const providers = React.useCallback(
    (serviceId: string | null) => (serviceId ? staff.filter((s) => s.serviceIds.includes(serviceId)) : staff),
    [staff],
  );

  const init = React.useMemo(() => {
    if (reschedule) return { service: reschedule.serviceId, staff: reschedule.staffId, step: "datetime" as Step };
    let service = services.find((s) => s.id === initial.serviceId)?.id ?? null;
    let staffId: string | null = staff.find((s) => s.id === initial.staffId)?.id ?? null;
    if (service && staffId && !providers(service).some((p) => p.id === staffId)) staffId = null;
    if (service && !staffId && providers(service).length === 1) staffId = providers(service)[0]!.id;
    if (!service && staffId) {
      const own = services.filter((s) => staff.find((m) => m.id === staffId)!.serviceIds.includes(s.id));
      if (own.length === 1) service = own[0]!.id;
    }
    const step: Step = !service ? "service" : !staffId ? "staff" : "datetime";
    return { service, staff: staffId, step };
  }, [reschedule, services, staff, initial, providers]);

  const [step, setStep] = React.useState<Step>(init.step);
  const [serviceId, setServiceId] = React.useState<string | null>(init.service);
  const [staffChoice, setStaffChoice] = React.useState<string | "any" | null>(init.staff);
  const [date, setDate] = React.useState<string | null>(initial.date ?? null);
  const [slot, setSlot] = React.useState<Slot | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const chosenStaff = staffChoice && staffChoice !== "any" ? staff.find((s) => s.id === staffChoice) ?? null : null;
  const staffFilter = staffChoice === "any" ? null : staffChoice;

  const { state, refetch } = useAvailability({
    slug: studio.slug,
    serviceId,
    staffId: staffFilter,
    reschedule: reschedule?.token,
    enabled: Boolean(serviceId && staffChoice) && (step === "datetime" || step === "details"),
  });
  const days = state.status === "success" ? state.data.days : [];

  // Default the date to the first day with free time.
  React.useEffect(() => {
    if (state.status !== "success" || !days.length) return;
    if (!date || !days.some((d) => d.date === date)) {
      setDate((days.find((d) => d.availableCount > 0) ?? days[0]!).date);
    }
  }, [state.status, days, date]);

  // Drop the chosen slot if it's no longer available after a refetch.
  React.useEffect(() => {
    if (!slot || state.status !== "success") return;
    const still = days.find((d) => d.date === date)?.slots.find((s) => s.startAt === slot.startAt && s.available);
    if (!still) setSlot(null);
  }, [state, days, date, slot]);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const dayIndex = days.findIndex((d) => d.date === date);
  const day = dayIndex >= 0 ? days[dayIndex] : undefined;
  const nextAvailable = days.slice(Math.max(dayIndex, 0) + 1).find((d) => d.availableCount > 0)?.date ?? null;

  const visibleSteps = reschedule ? (["datetime"] as Step[]) : STEPS;
  const stepNo = visibleSteps.indexOf(step) + 1;

  function goBack() {
    setServerError(null);
    if (reschedule || step === "service") {
      router.push(reschedule ? `/s/${studio.slug}/booking/${reschedule.token}` : `/s/${studio.slug}`);
      return;
    }
    if (step === "staff") setStep("service");
    if (step === "datetime") setStep(providers(serviceId).length === 1 ? "service" : "staff");
    if (step === "details") setStep("datetime");
  }

  function pickService(id: string) {
    setServiceId(id);
    setSlot(null);
    const list = providers(id);
    if (staffChoice && staffChoice !== "any" && list.some((p) => p.id === staffChoice)) {
      setStep("datetime");
    } else if (list.length === 1) {
      setStaffChoice(list[0]!.id);
      setStep("datetime");
    } else {
      setStaffChoice(null);
      setStep("staff");
    }
  }

  function pickStaff(id: string | "any") {
    setStaffChoice(id);
    setSlot(null);
    setStep("datetime");
  }

  async function submitDetails(values: BookingDetailsValues) {
    if (!service || !slot) return;
    setSubmitting(true);
    setServerError(null);
    const res = await createBooking({
      ...values,
      slug: studio.slug,
      serviceId: service.id,
      staffId: staffFilter,
      startAt: slot.startAt,
    });
    if (res.ok) {
      saveBooking(studio.slug, res.data.token);
      router.push(`/s/${studio.slug}/booking/${res.data.token}?new=1`);
      return;
    }
    setSubmitting(false);
    if (res.code && RETRY_CODES.includes(res.code)) {
      toast.error(res.error);
      setSlot(null);
      setStep("datetime");
      refetch();
      return;
    }
    setServerError(res.error);
  }

  async function confirmReschedule() {
    if (!reschedule || !slot) return;
    setSubmitting(true);
    const res = await rescheduleBooking({ token: reschedule.token, startAt: slot.startAt });
    if (res.ok) {
      router.push(`/s/${studio.slug}/booking/${reschedule.token}?rescheduled=1`);
      return;
    }
    setSubmitting(false);
    toast.error(res.error);
    if (res.code && RETRY_CODES.includes(res.code)) {
      setSlot(null);
      refetch();
    }
  }

  const cta =
    step === "datetime"
      ? reschedule
        ? { label: slot ? `Перенести на ${slot.time}` : "Выберите время", disabled: !slot, onClick: confirmReschedule }
        : { label: "Продолжить", disabled: !slot, onClick: () => setStep("details") }
      : step === "details"
        ? { label: "Записаться", disabled: false, form: DETAILS_FORM_ID }
        : null;

  const whenLabel = slot
    ? `${formatInTz(slot.startAt, studio.timezone, { weekday: "short", day: "numeric", month: "long" })}, ${slot.time}${service?.duration_days ? ` · ${service.duration_days} д` : ""}`
    : null;

  return (
    <div className="min-h-dvh pb-40 md:pb-16">
      {/* Top bar */}
      <header className="sticky top-0 z-sticky bg-background/90 backdrop-blur-md">
        <div className="container flex h-14 items-center gap-3 md:h-16">
          <Button variant="ghost" size="icon" onClick={goBack} aria-label="Назад" className="-ml-2">
            <ArrowLeft className="!size-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs uppercase tracking-[0.14em] text-subtle">
              {reschedule ? "Перенос записи" : `${studio.name} · шаг ${stepNo} из ${visibleSteps.length}`}
            </p>
          </div>
          <Button asChild variant="ghost" size="icon" aria-label="Закрыть" className="-mr-2">
            <Link href={`/s/${studio.slug}`}>
              <X className="!size-5" />
            </Link>
          </Button>
        </div>
        {!reschedule && (
          <div className="container">
            <div className="grid grid-cols-4 gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className={cn("h-0.5 rounded-full transition-colors duration-300", i < stepNo ? "bg-foreground" : "bg-surface-3")}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      <div className="container grid gap-10 pt-6 md:grid-cols-[1fr_340px] md:gap-14 md:pt-10">
        <main key={step} className="min-w-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h1 className="text-3xl font-medium md:text-4xl">{reschedule ? "Новое время" : stepTitle[step]}</h1>

          {step === "service" && (
            <ServiceStep services={services} categories={categories} currency={studio.currency} selected={serviceId} onPick={pickService} />
          )}

          {step === "staff" && service && (
            <ul className="mt-8 grid gap-2">
              <li>
                <OptionRow selected={staffChoice === "any"} onClick={() => pickStaff("any")}>
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-2">
                    <Shuffle className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{copy.anyResource}</span>
                    <span className="block text-sm text-muted-foreground">{copy.anyHint}</span>
                  </span>
                </OptionRow>
              </li>
              {providers(service.id).map((m) => (
                <li key={m.id}>
                  <OptionRow selected={staffChoice === m.id} onClick={() => pickStaff(m.id)}>
                    <span className="relative size-12 shrink-0 overflow-hidden rounded-full">
                      <SmartImage src={m.photo_url} alt="" fallbackLabel={m.name} fill sizes="48px" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{m.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{m.position}</span>
                    </span>
                  </OptionRow>
                </li>
              ))}
            </ul>
          )}

          {step === "datetime" && (
            <div className="mt-6 grid gap-8">
              {service?.duration_days && (
                <p className="rounded-2xl bg-surface px-4 py-3 text-sm text-muted-foreground">
                  Заезд в начале рабочего дня. Работа займёт {service.duration_days} {service.duration_days === 1 ? "рабочий день" : service.duration_days < 5 ? "рабочих дня" : "рабочих дней"}, выходные не считаются.
                </p>
              )}
              {reschedule && (
                <p className="text-muted-foreground">
                  Сейчас: {formatInTz(reschedule.startAt, studio.timezone, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
              {state.status === "loading" || state.status === "idle" ? (
                <>
                  <div className="flex gap-2 overflow-hidden md:hidden">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-[72px] w-14 shrink-0 animate-pulse rounded-2xl bg-surface" />
                    ))}
                  </div>
                  <SlotGridSkeleton />
                </>
              ) : state.status === "error" ? (
                <div className="grid justify-items-start gap-4 rounded-2xl border border-border p-6">
                  <p className="font-medium">{state.error}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={refetch}>
                      <RotateCw /> Повторить
                    </Button>
                    {state.code === "STAFF_UNAVAILABLE" && !reschedule && (
                      <Button variant="ghost" size="sm" onClick={() => pickStaff("any")}>
                        Любой специалист
                      </Button>
                    )}
                  </div>
                </div>
              ) : days.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-6 text-muted-foreground">
                  Сейчас нет специалистов, которые оказывают эту услугу. Выберите другую услугу или позвоните в студию.
                </div>
              ) : (
                <div className="grid gap-8 lg:grid-cols-[280px_1fr] lg:gap-10">
                  <div className="md:hidden">
                    <DateStrip days={days} selected={date} onSelect={(d) => { setDate(d); setSlot(null); }} />
                  </div>
                  <div className="hidden md:block">
                    <MonthCalendar days={days} selected={date} onSelect={(d) => { setDate(d); setSlot(null); }} />
                  </div>
                  <div>
                    {date && (
                      <p className="mb-4 text-sm capitalize text-muted-foreground">
                        {formatDateKey(date, { weekday: "long", day: "numeric", month: "long" })}
                      </p>
                    )}
                    <SlotGrid
                      day={day}
                      selected={slot?.startAt ?? null}
                      onSelect={setSlot}
                      onPrev={dayIndex > 0 ? () => { setDate(days[dayIndex - 1]!.date); setSlot(null); } : undefined}
                      onNext={dayIndex < days.length - 1 ? () => { setDate(days[dayIndex + 1]!.date); setSlot(null); } : undefined}
                      nextAvailable={nextAvailable}
                      onJump={(d) => { setDate(d); setSlot(null); }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === "details" && (
            <div className="mt-8 max-w-lg">
              <DetailsForm defaults={defaults} onSubmit={submitDetails} serverError={serverError} requireVehicle={copy.needsVehicle} />
            </div>
          )}
        </main>

        {/* Summary: sticky sidebar on desktop */}
        <aside className="hidden md:block">
          <div className="sticky top-24 grid gap-6 rounded-[1.5rem] border border-border p-6">
            <Summary
              studio={studio}
              service={service}
              staffLabel={chosenStaff?.name ?? (staffChoice === "any" ? copy.anyResource : null)}
              resourceLabel={copy.resource}
              whenLabel={whenLabel}
              onEdit={reschedule ? undefined : setStep}
            />
            {cta && (
              <Button
                size="lg"
                className="w-full"
                disabled={cta.disabled}
                loading={submitting}
                type={"form" in cta ? "submit" : "button"}
                form={"form" in cta ? cta.form : undefined}
                onClick={"onClick" in cta ? cta.onClick : undefined}
              >
                {cta.label}
              </Button>
            )}
          </div>
        </aside>
      </div>

      {/* Mobile sticky CTA */}
      {cta && (
        <div className="safe-bottom fixed inset-x-0 bottom-0 z-nav border-t border-border bg-background/95 backdrop-blur-md md:hidden">
          <div className="container flex items-center gap-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{service?.name}</p>
              <p className="truncate text-xs text-muted-foreground tabular">
                {[service && formatServicePrice(service.price, studio.currency, service.price_from), whenLabel ?? (service && formatServiceDuration(service))]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Button
              size="lg"
              disabled={cta.disabled}
              loading={submitting}
              type={"form" in cta ? "submit" : "button"}
              form={"form" in cta ? cta.form : undefined}
              onClick={"onClick" in cta ? cta.onClick : undefined}
            >
              {cta.label}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OptionRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border p-3 pr-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.99]",
        selected ? "border-foreground bg-surface-2" : "border-border hover:border-subtle hover:bg-surface",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
          selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
        )}
      >
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

function ServiceStep({
  services,
  categories,
  currency,
  selected,
  onPick,
}: {
  services: Service[];
  categories: ServiceCategory[];
  currency: string;
  selected: string | null;
  onPick: (id: string) => void;
}) {
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: services.filter((s) => s.category_id === c.id) })),
    { id: "none", name: "Другое", items: services.filter((s) => !s.category_id || !categories.some((c) => c.id === s.category_id)) },
  ].filter((g) => g.items.length);

  if (!services.length) {
    return <p className="mt-8 text-muted-foreground">Онлайн-запись на услуги пока недоступна. Позвоните в студию.</p>;
  }

  return (
    <div className="mt-8 grid gap-8">
      {groups.map((g) => (
        <div key={g.id}>
          {groups.length > 1 && <p className="eyebrow mb-3">{g.name}</p>}
          <ul className="grid gap-2">
            {g.items.map((s) => (
              <li key={s.id}>
                <OptionRow selected={selected === s.id} onClick={() => onPick(s.id)}>
                  <span className="min-w-0 flex-1 py-1 pl-1">
                    <span className="block font-medium uppercase tracking-[0.02em]">{s.name}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground tabular">
                      {formatServiceDuration(s)}
                    </span>
                  </span>
                  <span className="whitespace-nowrap text-base font-medium tabular">{formatServicePrice(s.price, currency, s.price_from)}</span>
                </OptionRow>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Summary({
  studio,
  service,
  staffLabel,
  whenLabel,
  onEdit,
  resourceLabel,
}: {
  studio: WizardProps["studio"];
  service: Service | null;
  staffLabel: string | null;
  whenLabel: string | null;
  onEdit?: (s: Step) => void;
  resourceLabel: string;
}) {
  const rows: { label: string; value: string | null; step: Step }[] = [
    { label: "Услуга", value: service ? `${service.name} · ${formatServiceDuration(service)}` : null, step: "service" },
    { label: resourceLabel, value: staffLabel, step: "staff" },
    { label: "Когда", value: whenLabel, step: "datetime" },
  ];
  return (
    <div className="grid gap-5">
      <div>
        <p className="text-lg font-medium">{studio.name}</p>
        {studio.address && <p className="text-sm text-muted-foreground">{studio.address}</p>}
      </div>
      <dl className="grid gap-4 border-t border-border pt-5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-subtle">{r.label}</dt>
              <dd className={cn("mt-0.5", r.value ? "text-foreground" : "text-subtle")}>{r.value ?? "Не выбрано"}</dd>
            </div>
            {onEdit && r.value && (
              <button type="button" onClick={() => onEdit(r.step)} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Изменить
              </button>
            )}
          </div>
        ))}
      </dl>
      {service && (
        <div className="flex items-baseline justify-between border-t border-border pt-5">
          <span className="text-sm text-subtle">Стоимость</span>
          <span className="text-2xl font-medium tabular">{formatServicePrice(service.price, studio.currency, service.price_from)}</span>
        </div>
      )}
    </div>
  );
}
