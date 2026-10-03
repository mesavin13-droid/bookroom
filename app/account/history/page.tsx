import { History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { AppointmentCard } from "@/components/account/appointment-card";
import { getMyAppointments } from "@/lib/data/account";
import { formatPrice } from "@/lib/format";

export default async function HistoryPage() {
  const items = await getMyAppointments("history");
  const spent = items.filter((a) => a.status === "completed").reduce((s, a) => s + Number(a.price), 0);
  const visits = items.filter((a) => a.status === "completed").length;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-medium md:text-4xl">История</h1>
        {visits > 0 && (
          <p className="text-sm text-muted-foreground tabular">
            {visits} визитов · {formatPrice(spent)}
          </p>
        )}
      </div>
      <div className="mt-6 grid gap-3">
        {items.length ? items.map((a) => <AppointmentCard key={a.id} a={a} />) : <EmptyState icon={History} title="Пока пусто" description="Здесь будут прошедшие и отменённые визиты." />}
      </div>
    </div>
  );
}
