import type { Metadata } from "next";
import { getStudio } from "@/lib/data/studio";
import { BRAND } from "@/lib/config";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const studio = await getStudio(slug).catch(() => null);
  if (!studio) return { title: `Студия не найдена | ${BRAND.name}` };
  const title = `${studio.name} — онлайн-запись`;
  const description = `Запишитесь онлайн в ${studio.name}${studio.address ? `, ${studio.address}` : ""}. ${
    studio.tagline ?? "Выберите услугу, мастера и удобное время."
  }`.trim();
  return {
    title,
    description,
    alternates: { canonical: `/s/${studio.slug}` },
    openGraph: {
      title,
      description,
      url: `/s/${studio.slug}`,
      images: studio.cover_url ? [{ url: studio.cover_url, width: 1200, height: 630, alt: studio.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
    icons: studio.logo_url ? { icon: studio.logo_url } : undefined,
    manifest: `/s/${studio.slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: studio.name, statusBarStyle: "black-translucent" },
  };
}

export default function StudioRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
