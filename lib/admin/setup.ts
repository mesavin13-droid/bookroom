import "server-only";
import type { AdminContext } from "@/lib/admin/context";

export interface SetupStep {
  id: string;
  title: string;
  hint: string;
  href: string;
  done: boolean;
  /** Required before the page can go live. */
  required: boolean;
}

export async function getSetupProgress(ctx: Pick<AdminContext, "supabase" | "studio">) {
  const id = ctx.studio.id;
  const auto = ctx.studio.vertical === "auto";
  const [studio, services, links, schedules, photos] = await Promise.all([
    ctx.supabase.from("studios").select("address, phone, logo_url, cover_url, is_published").eq("id", id).single(),
    ctx.supabase.from("services").select("id", { count: "exact", head: true }).eq("studio_id", id).eq("is_active", true).is("archived_at", null),
    ctx.supabase.from("staff_services").select("staff_id", { count: "exact", head: true }).eq("studio_id", id),
    ctx.supabase.from("staff_schedules").select("id", { count: "exact", head: true }).eq("studio_id", id).eq("is_working", true),
    ctx.supabase.from("media").select("id", { count: "exact", head: true }).eq("studio_id", id).eq("kind", "gallery"),
  ]);
  const s = (studio.data ?? {}) as { address: string | null; phone: string | null; logo_url: string | null; cover_url: string | null; is_published: boolean };

  const steps: SetupStep[] = [
    { id: "contacts", title: "Адрес и телефон", hint: "Клиент увидит их на странице и сможет построить маршрут", href: "/admin/settings", done: Boolean(s.address && s.phone), required: true },
    { id: "services", title: "Услуги и цены", hint: "Хотя бы одна услуга с ценой и длительностью", href: "/admin/services", done: (services.count ?? 0) > 0, required: true },
    {
      id: "resources",
      title: auto ? "Боксы и их услуги" : "Специалисты и их услуги",
      hint: auto ? "Отметьте, какие услуги выполняются в каждом боксе" : "Отметьте, какие услуги делает каждый мастер",
      href: "/admin/staff",
      done: (links.count ?? 0) > 0,
      required: true,
    },
    { id: "schedule", title: "Время работы", hint: "Рабочие дни и часы, перерывы, выходные", href: "/admin/schedule", done: (schedules.count ?? 0) > 0, required: true },
    { id: "logo", title: "Логотип", hint: "Появится в шапке и на иконке приложения", href: "/admin/settings#brand", done: Boolean(s.logo_url), required: false },
    { id: "cover", title: "Главное фото", hint: "Большая картинка на первом экране", href: "/admin/settings#brand", done: Boolean(s.cover_url), required: false },
    { id: "photos", title: "Фото работ", hint: "Пара удачных работ сильно повышает доверие", href: "/admin/settings#gallery", done: (photos.count ?? 0) > 0, required: false },
  ];
  const missingRequired = steps.filter((x) => x.required && !x.done);
  const done = steps.filter((x) => x.done).length + (s.is_published ? 1 : 0);
  return {
    steps,
    published: s.is_published,
    canPublish: missingRequired.length === 0,
    missingRequired,
    done,
    total: steps.length + 1,
  };
}
