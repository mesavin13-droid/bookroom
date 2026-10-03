import { Badge } from "@/components/ui/badge";
import type { AppointmentStatus } from "@/types";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Не пришёл",
};

export const STATUS_SHORT: Record<AppointmentStatus, string> = {
  pending: "Ожидает",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Неявка",
};

const VARIANT = {
  pending: "warning",
  confirmed: "default",
  completed: "success",
  cancelled: "muted",
  no_show: "destructive",
} as const;

export function StatusBadge({ status, short = false }: { status: AppointmentStatus; short?: boolean }) {
  return (
    <Badge variant={VARIANT[status]}>
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {short ? STATUS_SHORT[status] : STATUS_LABEL[status]}
    </Badge>
  );
}
