import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ServicesList } from "@/components/studio/services-list";
import { EmptyState } from "@/components/empty-state";
import { getStudioPageData } from "@/lib/data/studio";
import { Scissors } from "lucide-react";
import { copyFor } from "@/lib/vertical";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getStudioPageData((await params).slug).catch(() => null);
  return data ? { title: `Услуги и цены — ${data.studio.name}` } : {};
}

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getStudioPageData((await params).slug);
  if (!data) notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-14">
      <h1 className="text-[2.5rem] font-semibold md:text-6xl">Услуги и цены</h1>
      <p className="mt-4 max-w-xl text-[1.0625rem] text-muted-foreground">{copyFor(data.studio.vertical).priceNote}</p>
      <div className="mt-8">
        {data.services.length ? (
          <ServicesList slug={data.studio.slug} services={data.services} categories={data.categories} currency={data.studio.currency} withDescription />
        ) : (
          <EmptyState icon={Scissors} title="Прайс пока пуст" description="Онлайн-запись откроется, когда студия добавит услуги. Записаться можно по телефону." />
        )}
      </div>
    </main>
  );
}
