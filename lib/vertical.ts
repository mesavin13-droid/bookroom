import type { StudioVertical } from "@/types";

/** Wording per business type. The UI never hardcodes "мастер" or "бокс". */
export const VERTICAL_COPY = {
  beauty: {
    label: "Салон, барбершоп, студия",
    resource: "Специалист",
    resourcePlural: "Специалисты",
    resourceGenitive: "специалиста",
    anyResource: "Любой специалист",
    anyHint: "Покажем всё свободное время",
    statLabel: (n: number) => (n === 1 ? "специалист" : n < 5 ? "специалиста" : "специалистов"),
    bookTitle: "Время для себя",
    worksTitle: "Работы студии",
    priceNote: "Время указано с учётом подготовки и укладки.",
    needsVehicle: false,
  },
  auto: {
    label: "Детейлинг, автосервис, СТО",
    resource: "Бокс",
    resourcePlural: "Боксы",
    resourceGenitive: "бокс",
    anyResource: "Любой свободный бокс",
    anyHint: "Подберём бокс с ближайшим временем",
    statLabel: (n: number) => (n === 1 ? "бокс в работе" : n < 5 ? "бокса в работе" : "боксов в работе"),
    bookTitle: "Свежий вид для вашего авто",
    worksTitle: "Работы студии",
    priceNote: "Время включает работу с автомобилем. Стоимость «от» уточняется после осмотра.",
    needsVehicle: true,
  },
} as const;

export function copyFor(vertical: StudioVertical | null | undefined) {
  return VERTICAL_COPY[vertical ?? "beauty"];
}
