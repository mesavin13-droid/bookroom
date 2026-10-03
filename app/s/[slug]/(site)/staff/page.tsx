import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";
import { StaffGrid } from "@/components/studio/staff-grid";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getStudioPageData } from "@/lib/data/studio";
import { copyFor } from "@/lib/vertical";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await getStudioPageData((await params).slug).catch(() => null);
  return data ? { title: `${copyFor(data.studio.vertical).resourcePlural} — ${data.studio.name}` } : {};
}

export default async function StaffPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getStudioPageData((await params).slug);
  if (!data) notFound();
  const copy = copyFor(data.studio.vertical);
  return (
    <main className="container py-10 md:py-16">
      <p className="eyebrow">{data.studio.name}</p>
      <h1 className="mt-3 text-4xl font-semibold md:text-6xl">{copy.resourcePlural}</h1>
      <div className="mt-10">
        {data.staff.length ? (
          <StaffGrid slug={data.studio.slug} staff={data.staff} services={data.services} layout="grid" />
        ) : (
          <EmptyState icon={Users} title={`${copy.resourcePlural} не добавлены`} description="Запись по-прежнему доступна: студия назначит исполнителя сама." />
        )}
      </div>
      <Link href={`/s/${data.studio.slug}/book`} className="mt-12 inline-flex h-14 items-center gap-2.5 rounded-full bg-primary px-9 font-semibold text-primary-foreground transition-transform active:scale-[0.98]">
        {copy.anyResource} <ArrowUpRight className="size-5" />
      </Link>
    </main>
  );
}
