import { QrCode, Rocket, BarChart3, Bell, CalendarDays, ClipboardList, Clock, MessageSquare, Scissors, Settings, Users, UserSquare } from "lucide-react";
import type { StudioRole } from "@/types";

export const ADMIN_NAV = [
  { href: "/admin", label: "Сводка", icon: BarChart3, exact: true, roles: ["owner", "admin"] },
  { href: "/admin/setup", label: "Запуск", icon: Rocket, roles: ["owner", "admin"] },
  { href: "/admin/calendar", label: "Календарь", icon: CalendarDays, roles: ["owner", "admin", "staff"] },
  { href: "/admin/appointments", label: "Записи", icon: ClipboardList, roles: ["owner", "admin", "staff"] },
  { href: "/admin/clients", label: "Клиенты", icon: Users, roles: ["owner", "admin"] },
  { href: "/admin/staff", label: "Специалисты", icon: UserSquare, roles: ["owner", "admin"] },
  { href: "/admin/services", label: "Услуги", icon: Scissors, roles: ["owner", "admin"] },
  { href: "/admin/schedule", label: "Расписание", icon: Clock, roles: ["owner", "admin"] },
  { href: "/admin/reviews", label: "Отзывы", icon: MessageSquare, roles: ["owner", "admin"] },
  { href: "/admin/notifications", label: "Уведомления", icon: Bell, roles: ["owner", "admin"] },
  { href: "/admin/share", label: "Ссылка и QR", icon: QrCode, roles: ["owner", "admin"] },
  { href: "/admin/settings", label: "Настройки", icon: Settings, roles: ["owner", "admin"] },
] as const satisfies readonly { href: string; label: string; icon: unknown; exact?: boolean; roles: readonly StudioRole[] }[];

export const MOBILE_PRIMARY = ["/admin", "/admin/calendar", "/admin/appointments", "/admin/clients"];
