import { NextResponse } from "next/server";
import { getStudio } from "@/lib/data/studio";

export const revalidate = 3600;

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await getStudio(slug).catch(() => null);
  if (!studio) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(
    {
      name: studio.name,
      short_name: studio.name.slice(0, 12),
      description: studio.tagline ?? `Онлайн-запись в ${studio.name}`,
      start_url: `/s/${studio.slug}`,
      scope: `/s/${studio.slug}`,
      display: "standalone",
      background_color: "#0b0c0f",
      theme_color: "#0b0c0f",
      lang: "ru",
      icons: [
        { src: studio.logo_url ?? "/icon.svg", sizes: "any", type: studio.logo_url ? "image/png" : "image/svg+xml", purpose: "any" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } },
  );
}
