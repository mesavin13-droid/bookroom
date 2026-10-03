import type { Metadata } from "next";
import { BrandMark } from "@/components/brand";
import { BRAND } from "@/lib/config";

export const metadata: Metadata = { title: `Политика обработки персональных данных | ${BRAND.name}` };

export default function PrivacyPage() {
  return (
    <main className="container max-w-2xl py-10">
      <BrandMark />
      <h1 className="mt-12 text-4xl font-medium">Политика обработки персональных данных</h1>
      <div className="mt-8 grid gap-5 text-muted-foreground [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-foreground">
        <p>
          Оформляя запись, вы передаёте студии имя, телефон и, по желанию, email и комментарий. Эти данные нужны только
          для записи на услугу и связи по ней.
        </p>
        <h2>Что мы храним</h2>
        <p>Имя, телефон, email, историю записей и отзывы. Мы не продаём и не передаём данные третьим лицам.</p>
        <h2>Кто видит данные</h2>
        <p>Только сотрудники студии, в которую вы записались, и вы сами в личном кабинете.</p>
        <h2>Как удалить данные</h2>
        <p>
          Напишите студии или на {BRAND.supportEmail}. Мы удалим персональные данные в течение 30 дней, кроме сведений,
          которые обязаны хранить по закону.
        </p>
      </div>
    </main>
  );
}
