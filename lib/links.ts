import type { Studio } from "@/types";

function handle(v: string) {
  const h = v.replace(/^https?:\/\/[^/]+\//, "").replace(/^@/, "").replace(/\/$/, "");
  return encodeURIComponent(h.replace(/[^\w.\-]/g, ""));
}

const safeHttp = (u: string) => (/^https?:\/\//i.test(u) ? u : null);

export function socialLinks(studio: Pick<Studio, "telegram" | "vk" | "instagram" | "website">) {
  const out: { label: string; href: string; value: string }[] = [];
  if (studio.telegram) out.push({ label: "Telegram", href: `https://t.me/${handle(studio.telegram)}`, value: `@${handle(studio.telegram)}` });
  if (studio.vk) out.push({ label: "VK", href: `https://vk.com/${handle(studio.vk)}`, value: handle(studio.vk) });
  if (studio.instagram)
    out.push({ label: "Instagram", href: `https://instagram.com/${handle(studio.instagram)}`, value: `@${handle(studio.instagram)}` });
  const site = studio.website ? safeHttp(studio.website) : null;
  if (site) out.push({ label: "Сайт", href: site, value: site.replace(/^https?:\/\//i, "") });
  return out;
}

export function routeLink(studio: Pick<Studio, "latitude" | "longitude" | "address">) {
  if (studio.latitude != null && studio.longitude != null) {
    return `https://yandex.ru/maps/?rtext=~${studio.latitude},${studio.longitude}&rtt=auto`;
  }
  return `https://yandex.ru/maps/?text=${encodeURIComponent(studio.address ?? "")}`;
}
