# BOOKROOM

Онлайн-запись для студий, салонов и барбершопов. Next.js 15 (App Router) + TypeScript + Tailwind + shadcn-style UI + Supabase (Postgres, Auth, Storage, RLS). Без ИИ-функций.

## Быстрый старт (локально)

```bash
npm install
npx supabase start            # нужен Docker; поднимает Postgres, Auth, Storage
npx supabase db reset         # применяет миграции + demo seed
cp .env.example .env.local    # вставьте anon и service_role ключи из `supabase status`
npm run dev
```

Откройте http://localhost:3000/s/nord (детейлинг) или http://localhost:3000/s/graphite (барбершоп)

Демо-доступы (только локально):
- Владелец: `owner@bookroom.dev` / `bookroom-demo` → /admin (две студии, есть переключатель)
- Клиент: `client@bookroom.dev` / `bookroom-demo` → /account
- Вход по SMS локально: `+7 999 000-00-00`, код `123456` (см. `supabase/config.toml`)
- Письма с кодами локально: http://127.0.0.1:54324 (Inbucket)

## Облачный Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push           # миграции
psql "$DATABASE_URL" -f supabase/seed.sql   # демо-данные (по желанию)
```
В Auth включите Email OTP; для входа по телефону подключите SMS-провайдера. Добавьте `<SITE_URL>/auth/callback` в Redirect URLs. Для напоминаний включите pg_cron и выполните:
`select cron.schedule('bookroom-reminders', '*/15 * * * *', $$select public.enqueue_appointment_reminders()$$);`

## Ниши (тип бизнеса)

У студии поле `vertical`: `beauty` (салоны, барбершопы) или `auto` (детейлинг, автосервисы, СТО). Меняются термины (специалисты / боксы), в записи появляются марка, модель и госномер. Настраивается в /admin/settings.

- **Цена «от»**: `services.price_from`.
- **Многодневные услуги**: `services.duration_days`. Запись начинается в открытие бокса и занимает N рабочих дней, выходные пропускаются. Проверяется и в движке слотов, и в БД (`_booking_end`), пересечения блокирует тот же exclusion constraint.
- **«Добавить на экран»**: манифест на каждую студию (`/s/[slug]/manifest.webmanifest`) + service worker, на iOS показывается подсказка.
- **«Моя запись»**: записи сохраняются на устройстве по приватной ссылке, без аккаунта.

## Три кабинета

| Кто | Где | Что делает |
| --- | --- | --- |
| Клиент | `/s/<slug>`, `/account` | Записывается, переносит, отменяет, видит историю |
| Владелец СТО / студии | `/start` → `/admin` | Регистрируется, заполняет страницу, ведёт записи и клиентов |
| Владелец платформы | `/platform` | Видит все студии, статистику, блокирует и разблокирует |

**Путь владельца:** `/start` (код на почту или SMS) → `/admin/onboarding` (тип бизнеса, название, адрес ссылки, город, телефон) → `/admin/setup` (чек-лист: контакты, услуги, боксы, график, логотип, обложка, фото работ) → «Опубликовать» → `/admin/share` (ссылка, сообщение для мессенджеров, QR в PNG/SVG, плакат на ресепшен).

Новая студия сразу получает категории под свой тип бизнеса, первый бокс или мастера и график Пн–Сб. До публикации страница не видна клиентам. Публикация проверяется на сервере: нужны контакты, хотя бы одна услуга, бокс/мастер с услугами и рабочие часы.

**Доступ к /platform** выдаётся по email: таблица `platform_admin_emails`. При первом входе с этим адресом аккаунт автоматически становится админом платформы. В демо-данных уже есть `me.savin13@gmail.com` и `admin@bookroom.dev` / `bookroom-demo`. Для облака:

```sql
insert into public.platform_admin_emails (email) values ('you@example.com');
-- если аккаунт уже существует:
insert into public.platform_admins (profile_id)
select id from public.profiles where email = 'you@example.com' on conflict do nothing;
```

Блокировка снимает страницу с публикации и запрещает владельцу включить её обратно (триггер в БД). Причина видна владельцу в кабинете, все действия пишутся в `platform_audit`. Персональные данные клиентов студий на платформе не показываются, только агрегаты.

## Архитектура

- `supabase/migrations` — схема, функции, RLS, storage. Все таблицы под RLS.
- **Защита от двойной записи**: exclusion constraint `appointments_no_overlap` (btree_gist, `tstzrange`) + серверная проверка в `book_appointment()` (часы работы, перерывы, отпуск, мин. время до записи, горизонт). Гонку двух клиентов разрешает БД, второй получает «Это время только что заняли».
- `lib/booking/slots.ts` — чистый движок расчёта слотов (покрыт тестами `npm test`), `lib/booking/availability.ts` + `/api/studios/[slug]/availability` — данные для UI.
- Гостевая запись без регистрации; управление по секретной ссылке `/s/[slug]/booking/[token]`. После входа записи привязываются по подтверждённому телефону/email (`claim_my_clients`).
- Уведомления: триггер на `appointments` пишет `notifications` + outbox `notification_deliveries` (in_app отправлено, email/sms/telegram в статусе pending для будущего воркера). В `profiles`/`clients` есть `telegram_user_id`, `telegram_username`.
- Роли: owner / admin / staff (`studio_members`). Сотрудник видит только свои записи.
- Переименование продукта: `lib/config.ts` + `app/icon.svg`.

## Проверки

- `npm test` — тесты движка слотов
- `npm run typecheck`, `npm run build`
