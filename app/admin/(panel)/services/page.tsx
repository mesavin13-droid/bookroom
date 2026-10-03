import { Pencil, Scissors } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryManager, ServiceRowActions, ServiceSheet } from "@/components/admin/service-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { requireManagerPage } from "@/lib/admin/context";
import { getCatalog } from "@/lib/data/admin";
import { formatServiceDuration, formatServicePrice } from "@/lib/format";

export default async function ServicesAdminPage() {
  const ctx = await requireManagerPage();
  const { services, staff, categories, links } = await getCatalog(ctx);
  const groups = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: services.filter((s) => s.category_id === c.id) })),
    { id: "none", name: "Без категории", items: services.filter((s) => !s.category_id) },
  ].filter((g) => g.items.length);

  return (
    <div>
      <PageHeader title="Услуги" description={`${services.length} в прайсе`} actions={<ServiceSheet categories={categories} staff={staff} />} />

      {services.length ? (
        <div className="grid gap-10">
          {groups.map((g) => (
            <section key={g.id}>
              <h2 className="eyebrow mb-3">{g.name}</h2>
              <ul className="divide-y divide-border rounded-2xl border border-border">
                {g.items.map((s) => {
                  const staffIds = links.filter((l) => l.service_id === s.id).map((l) => l.staff_id);
                  return (
                    <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{s.name}</p>
                          {!s.is_active && <Badge variant="muted">Скрыта</Badge>}
                          {!staffIds.length && <Badge variant="warning">Нет специалистов</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {formatServiceDuration(s)} · {staffIds.length} {ctx.studio.vertical === "auto" ? "бокс." : "спец."}
                        </p>
                      </div>
                      <p className="text-lg font-medium tabular">{formatServicePrice(s.price, ctx.studio.currency, s.price_from)}</p>
                      <ServiceRowActions
                        id={s.id}
                        isActive={s.is_active}
                        trigger={
                          <ServiceSheet
                            categories={categories}
                            staff={staff}
                            trigger={
                              <Button variant="ghost" size="icon-sm" aria-label="Изменить">
                                <Pencil />
                              </Button>
                            }
                            defaults={{
                              id: s.id,
                              name: s.name,
                              description: s.description ?? "",
                              categoryId: s.category_id ?? "",
                              price: s.price,
                              durationMinutes: s.duration_minutes,
                              durationDays: s.duration_days,
                              priceFrom: s.price_from,
                              isActive: s.is_active,
                              staffIds,
                            }}
                          />
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState icon={Scissors} title="Прайс пуст" description="Добавьте первую услугу, чтобы клиенты могли записаться." />
      )}

      <section className="mt-14 border-t border-border pt-8">
        <h2 className="text-xl font-medium">Категории</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">Нажмите на категорию, чтобы переименовать.</p>
        <CategoryManager categories={categories} />
      </section>
    </div>
  );
}
