import { PageHeader } from "@/components/admin/page-header";
import { BookingSettingsForm, BrandImage, GalleryManager, StudioProfileForm } from "@/components/admin/settings-forms";
import { requireManagerPage } from "@/lib/admin/context";
import { formatPhone } from "@/lib/format";
import type { Media, Studio, StudioSettings } from "@/types";

export default async function SettingsPage() {
  const ctx = await requireManagerPage();
  const [{ data: studio }, { data: settings }, { data: media }] = await Promise.all([
    ctx.supabase.from("studios").select("*").eq("id", ctx.studio.id).single(),
    ctx.supabase.from("studio_settings").select("*").eq("studio_id", ctx.studio.id).single(),
    ctx.supabase.from("media").select("*").eq("studio_id", ctx.studio.id).eq("kind", "gallery").order("sort_order"),
  ]);
  const s = studio as Studio;
  const b = settings as StudioSettings;

  return (
    <div className="max-w-4xl">
      <PageHeader title="Настройки" />

      <section className="grid gap-6">
        <h2 className="text-xl font-medium">Студия</h2>
        <StudioProfileForm
          defaults={{
            name: s.name,
            slug: s.slug,
            kind: s.kind ?? "",
            tagline: s.tagline ?? "",
            description: s.description ?? "",
            address: s.address ?? "",
            city: s.city ?? "",
            phone: s.phone ? formatPhone(s.phone) : "",
            email: s.email ?? "",
            website: s.website ?? "",
            telegram: s.telegram ?? "",
            vk: s.vk ?? "",
            instagram: s.instagram ?? "",
            timezone: s.timezone,
            vertical: s.vertical,
            isPublished: s.is_published,
          }}
        />
      </section>

      <section id="brand" className="mt-14 grid scroll-mt-24 gap-6 border-t border-border pt-10">
        <h2 className="text-xl font-medium">Логотип и обложка</h2>
        <div className="grid gap-8 md:grid-cols-[160px_1fr]">
          <BrandImage kind="logo" url={s.logo_url} label="Логотип" />
          <BrandImage kind="cover" url={s.cover_url} label="Обложка (главное фото)" />
        </div>
      </section>

      <section id="gallery" className="mt-14 grid scroll-mt-24 gap-6 border-t border-border pt-10">
        <div>
          <h2 className="text-xl font-medium">Фото работ</h2>
          <p className="mt-1 text-sm text-muted-foreground">Интерьер, работы, детали. До 5 МБ на фото.</p>
        </div>
        <GalleryManager items={((media ?? []) as Media[]).map((m) => ({ id: m.id, url: m.url, alt: m.alt }))} />
      </section>

      <section className="mt-14 grid gap-6 border-t border-border pt-10">
        <div>
          <h2 className="text-xl font-medium">Правила онлайн-записи</h2>
          <p className="mt-1 text-sm text-muted-foreground">Проверяются на сервере при каждой записи, переносе и отмене.</p>
        </div>
        <BookingSettingsForm
          defaults={{
            minNoticeMinutes: b.min_notice_minutes,
            maxAdvanceDays: b.max_advance_days,
            cancelNoticeMinutes: b.cancel_notice_minutes,
            allowReschedule: b.allow_reschedule,
            autoConfirm: b.auto_confirm,
            slotStepMinutes: b.slot_step_minutes,
          }}
        />
      </section>
    </div>
  );
}
