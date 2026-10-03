import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { AppointmentCard } from "@/components/account/appointment-card";
import { getMyAppointments } from "@/lib/data/account";

export default async function UpcomingPage() {
  const items = await getMyAppointments("upcoming");
  return (
    <div>
      <h1 className="text-3xl font-medium md:text-4xl">Предстоящие записи</h1>
      <div className="stagger mt-6 grid gap-3">
        {items.length ? (
          items.map((a, i) => (
            <div key={a.id} style={{ ["--i" as string]: i }}>
              <AppointmentCard a={a} />
            </div>
          ))
        ) : (
          <EmptyState
            icon={CalendarPlus}
            title="Предстоящих записей нет"
            action={
              <Button asChild variant="outline">
                <Link href="/">Записаться</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
