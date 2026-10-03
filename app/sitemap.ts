import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { listPublishedStudios } from "@/lib/data/studio";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const studios = await listPublishedStudios().catch(() => []);
  return [
    { url: SITE_URL, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/start`, changeFrequency: "monthly", priority: 0.6 },
    ...studios.flatMap((s) => [
      { url: `${SITE_URL}/s/${s.slug}`, changeFrequency: "daily" as const, priority: 1 },
      { url: `${SITE_URL}/s/${s.slug}/services`, changeFrequency: "weekly" as const, priority: 0.7 },
      { url: `${SITE_URL}/s/${s.slug}/staff`, changeFrequency: "weekly" as const, priority: 0.6 },
      { url: `${SITE_URL}/s/${s.slug}/reviews`, changeFrequency: "weekly" as const, priority: 0.5 },
    ]),
  ];
}
