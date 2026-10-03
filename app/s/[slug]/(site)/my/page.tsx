import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MyBookings } from "@/components/studio/my-bookings";
import { getStudio } from "@/lib/data/studio";

export const metadata: Metadata = { title: "Моя запись", robots: { index: false } };

export default async function MyBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const studio = await getStudio(slug);
  if (!studio) notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 md:px-8">
      <MyBookings slug={studio.slug} />
    </main>
  );
}
