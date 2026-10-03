# Развёртывание Supabase для BOOKROOM

Проект использует Supabase (Postgres + Auth + Storage) с полностью RLS-обёрнутой схемой.
Локально нужен Docker; в проде — облачный проект.

## Текущее состояние

Облачный проект `klcqalehqhhmjfvlpakl` («booktoom») развёрнут, все 7 миграций применены.
Проверено: 20 таблиц, RLS включён на всех таблицах `public`, exclusion constraint
`appointments_no_overlap`, 30 триггеров, 41 функция, бакеты `avatars` / `gallery` / `studio-assets`.
Все 20 таблиц и RPC-функции проверены живым запросом к REST API.

> ⚠️ **Ключи.** На этом проекте новый формат `sb_secret_...` возвращает **401**.
> Рабочий ключ — legacy JWT `service_role` (`eyJ...`). Это проверено запросом к REST API.

> ⚠️ **Пароль БД не совпадает с ключами API.** `supabase db push` требует именно пароль БД
> из Settings → Database. С персональным токеном (Management API) миграции применяются
> через `POST /v1/projects/<ref>/database/query`.

### Что ещё не подключено (блокирует вход)

| Что | Статус | Что нужно |
| --- | --- | --- |
| **SMS для телефона** | `phone_enabled` выкл, `sms_twilio_*` пусто → `phone_provider_disabled` | Аккаунт Twilio (или MessageBird/Vonage/Textlocal) + ключи в Settings → Authentication → SMS |
| **SMTP для почты** | Не настроен, используется встроенный отправщик Supabase | Сервис Resend / SendGrid / Mailgun в Settings → Authentication → Email |
| **Лимит писем** | `rate_limit_email_sent = 2` в час — этого хватает на 2 попытки | Поднять после подключения SMTP |
| **Site URL / Redirect URLs** | `site_url = http://localhost:3000` | Указать `https://<домен>` и `https://<домен>/auth/callback` в Settings → Authentication → URL Configuration |

Пока SMS и SMTP не подключены, вход невозможен ни по телефону, ни по почте.
Форма входа обрабатывает это корректно и предлагает сменить способ, а не падает.

## Вариант A. Облачный Supabase (для Vercel)

### 1. Создать проект
https://supabase.com/dashboard → **New project**. Придумайте надёжный пароль БД — он больше не показывается.

### 2. Получить ключи
**Project Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (серверная переменная, никогда не публикуйте)

### 3. Применить миграции
```bash
npx supabase login                # откроет браузер
npx supabase link --project-ref <ref>   # ref из URL: https://supabase.com/dashboard/project/<ref>
npx supabase db push              # применит 7 миграций из supabase/migrations
```

> `db push` спросит пароль БД — введите пароль из шага 1.

### 4. Настроить Auth
**Authentication → URL Configuration**:
- Site URL: `https://<ваш-домен>.vercel.app`
- Redirect URLs: `https://<ваш-домен>.vercel.app/auth/callback`

Включите **Email OTP** для входа по коду. Для телефона подключите SMS-провайдера.

### 5. Переменные окружения на Vercel
Project Settings → Environment Variables:

| Переменная | Значение | Видна клиенту |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL | да |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public | да |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role | **НЕТ** |
| `NEXT_PUBLIC_SITE_URL` | `https://<ваш-домен>.vercel.app` | да |

### 6. Напоминания о записях (опционально)
В SQL Editor:
```sql
create extension if not exists pg_cron;
select cron.schedule('bookroom-reminders', '*/15 * * * *', $$select public.enqueue_appointment_reminders()$$);
```

## Вариант B. Локально (нужен Docker Desktop)

```bash
npm install
npx supabase start
npx supabase db reset              # миграции + демо-данные
npx supabase status               # возьмите отсюда anon и service_role ключи
cp .env.example .env.local
npm run dev
```

Откройте http://localhost:3000/s/nord (детейлинг) или /s/graphite (барбершоп).
Письма с кодами: http://127.0.0.1:54324 (Inbucket).

**Демо-доступы (только локально):**
- Владелец: `owner@bookroom.dev` / `bookroom-demo` → `/admin`
- Клиент: `client@bookroom.dev` / `bookroom-demo` → `/account`

## Админ платформы

Доступ к `/platform` выдаётся по email в таблице `platform_admin_emails`.
```sql
insert into public.platform_admin_emails (email) values ('вы@example.com');
```
При первом входе с этим адресом аккаунт станет админом платформы автоматически.

## Важно перед продом

1. Не загружать `supabase/seed.sql` — там демо-пароли.
2. Включить CAPTCHA, свой SMTP и SMS-провайдера; удалить тестовые номера `test_otp`.
3. Site URL и Redirect URLs — только ваш домен.
4. Включить бэкапы / Point-in-Time Recovery.
5. `SUPABASE_SERVICE_ROLE_KEY` — только в переменных сервера, без префикса `NEXT_PUBLIC_`.

Подробности модели доступа — в [SECURITY.md](SECURITY.md).

---

## Telegram: вход, пуши и Mini App

Telegram-слой уже развёрнут: миграция `supabase/migrations/20261004000800_telegram.sql`.

### Почему вход сделан вручную

Supabase Auth не умеет вход через Telegram «из коробки». Telegram перешёл на OIDC и
подписал ключи кривой `secp256k1`, которую библиотека `go-jose` в gotrue не поддерживает
([supabase/auth#2534](https://github.com/supabase/auth/issues/2534), фикс
[#2548](https://github.com/supabase/auth/pull/2548) не задеплоен). Поэтому вход
проверяется собственным маршрутом `POST /api/auth/telegram`: подпись Telegram
(HMAC-SHA256 от токена бота) проверяется на сервере, затем выдаётся сессия Supabase.

### Переменные окружения

| Переменная | Где | Пример |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | только сервер (Secret) | `123456:AA...` |
| `TELEGRAM_DISPATCH_SECRET` | только сервер (Secret), совпадает с Vault | случайная строка |
| `NEXT_PUBLIC_TELEGRAM_BOT_ID` | клиент (Config) | `8822412364` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | клиент (Config) | `svn_nskbot` |

Токен бота **никогда** не попадает в браузер.

### Vault (для pg_cron-страховки)

Планировщик дренирует очередь раз в 5 минут на случай, если процесс оборвался
после создания записи:

```sql
select vault.create_secret('<dispatch secret>', 'bookroom_telegram_dispatch',
                           'Shared secret for the Telegram dispatcher');
select vault.create_secret('https://<host>/api/internal/telegram/dispatch',
                           'bookroom_telegram_dispatch_url', 'Dispatcher endpoint');
```

Задание уже создано: `cron.job` → `bookroom-telegram-dispatch` (`*/5 * * * *`).

### Mini App в @BotFather

1. `/newbot` — создать бота.
2. **Login Widget** — включить scopes `Email` и `Phone`, алгоритм `RS256`,
   добавить домен приложения.
3. **Menu Button** — указать `https://<host>/tg` (обязательно HTTPS).

### Как включить пуши

1. Владелец открывает `/admin/settings` → раздел **Telegram** → «Подключить».
2. Открывает бота и жмёт **Старт** (без этого бот не может писать).
3. Возвращается и жмёт «Готово» — чат сохраняется, канал включается автоматически.

### Ограничения Telegram

- Бот не пишет пользователю, который не нажал «Старт». Это не обходится.
- Сообщения приходят, пока чат открыт или включены уведомления. Для критичных
  событий дублируйте на email.
- Вход по номеру возможен **без SMS-провайдера**: Telegram отдаёт
  подтверждённый телефон (`phone_number_verified`), который подставляется в профиль.