<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1iEyMT_otaxkuigZ1ZSRTKg07YvtK57Kl

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Database configuration

The app now reads and writes venue data directly from Supabase instead of Google Apps Script. Provide the following environment variables before running:

- `VITE_SUPABASE_URL` – project URL
- `VITE_SUPABASE_ANON_KEY` – anonymous key with access to the `venues`, `flavors`, and `brands` tables
- `VITE_TELEGRAM_BOT_ID` – бот, который будет использоваться для OAuth
- `VITE_TELEGRAM_BOT_TOKEN` – токен бота, нужен для проверки подписи ответа Telegram (хранится только в клиенте, поэтому держите бота техническим)
- `VITE_BACKEND_URL` – базовый URL API, если эндпоинт `/api/auth/telegram/callback` работает на другом домене (по умолчанию текущий)

Expected schema:

- `venues`: `id`, `title`, `city`, `logo`, `subscription_until`, `visible`, `admin_pin`, `flavor_schema`
- `flavors`: `id`, `venue_id`, `name`, `brand`, `description`, `color`, `is_available`
- `brands`: `name`, `venue_id`
- `user_mixes`: `id` (uuid), `user_id` (bigint), `name`, `ingredients` (jsonb), `is_favorite` (bool, default false), `venue` (jsonb), `created_at` (timestamptz, default now())
- `clients`: `id` (bigint, PK), `first_name`, `last_name`, `username`, `language_code`, `last_seen_at` (timestamptz, default now())

Each venue keeps its own stock and PIN; saving flavors does not overwrite `admin_pin`.

### Telegram login checklist

1. Создайте бота в @BotFather и получите `VITE_TELEGRAM_BOT_ID` и `VITE_TELEGRAM_BOT_TOKEN`.
2. В настройках бота укажите домен, на котором открывается приложение, чтобы Telegram разрешил OAuth-авторизацию.
3. В Supabase создайте таблицу `user_mixes` (см. схему выше) и индекс по `user_id` для быстрых выборок:
   ```sql
   create index user_mixes_user_id_idx on public.user_mixes (user_id);
   ```
   Для авторизации по Telegram также нужна таблица клиентов:
   ```sql
   create table if not exists public.clients (
     id bigint primary key,
     first_name text not null,
     last_name text,
     username text,
     language_code text,
     last_seen_at timestamptz default now()
   );

   create index if not exists clients_last_seen_at_idx on public.clients (last_seen_at desc);
   ```

   Supabase UI может показывать `int8` вместо `bigint` — это один и тот же тип, его достаточно для Telegram ID.

   Если в проекте включён RLS, добавьте политики, иначе анонимный ключ не сможет записывать клиентов и миксы:

   ```sql
   -- clients: позволяем вставку/апдейт от любого (анон) запроса
   create policy clients_insert on public.clients
     for insert to anon using (true) with check (true);
   create policy clients_update on public.clients
     for update to anon using (true) with check (true);

   -- user_mixes: читаем/пишем только свои записи
   create policy user_mixes_select on public.user_mixes
     for select to anon using (auth.role() = 'anon');
   create policy user_mixes_insert on public.user_mixes
     for insert to anon with check (auth.role() = 'anon');
   ```
4. Заполните `.env.local` нужными переменными, затем выполните `npm run dev`.
5. После входа через Telegram история и избранные миксы сохраняются в `user_mixes` и доступны с любого устройства.

### Telegram callback endpoint

В репозитории есть минимальный валидатор подписи Telegram: `node server/telegramAuth.js`. Он поднимает эндпоинт `/api/auth/telegram/callback`,
который проверяет HMAC (secret_key = sha256(BOT_TOKEN)), ограничивает `auth_date` 10 минутами и требует HTTPS (`X-Forwarded-Proto: https`).
Установите `TELEGRAM_BOT_TOKEN` в окружении и проксируйте этот путь с HTTPS-домена, совпадающего с настроенным в BotFather.
