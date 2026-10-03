import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteStaffButton, StaffForm } from "@/components/admin/staff-form";
import { requireManagerPage } from "@/lib/admin/context";
import { getCatalog } from "@/lib/data/admin";

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireManagerPage();
  const { id } = await params;
  const catalog = await getCatalog(ctx);
  const s = catalog.staff.find((x) => x.id === id);
  if (!s) notFound();

  return (
    <div className="max-w-xl">
      <Link href="/admin/staff" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Специалисты
      </Link>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-medium">{s.name}</h1>
        <Button asChild variant="outline">
          <Link href={`/admin/schedule?staff=${s.id}`}>
            <Clock /> Расписание и отпуск
          </Link>
        </Button>
      </div>
      <StaffForm
        services={catalog.services}
        defaults={{
          id: s.id,
          name: s.name,
          position: s.position ?? "",
          bio: s.bio ?? "",
          isActive: s.is_active,
          photoUrl: s.photo_url,
          serviceIds: catalog.links.filter((l) => l.staff_id === s.id).map((l) => l.service_id),
        }}
      />
      <div className="mt-10 border-t border-border pt-6">
        <DeleteStaffButton id={s.id} />
        <p className="mt-2 text-xs text-subtle">Если у специалиста есть история, записи сохранятся, а сам он исчезнет из расписания и страницы студии.</p>
      </div>
    </div>
  );
}
