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

Expected schema:

- `venues`: `id`, `title`, `city`, `logo`, `subscription_until`, `visible`, `admin_pin`, `flavor_schema`
- `flavors`: `id`, `venue_id`, `name`, `brand`, `description`, `color`, `is_available`
- `brands`: `name`, `venue_id`
- `user_mixes`: `id` (uuid), `user_id` (bigint), `name`, `ingredients` (jsonb), `is_favorite` (bool, default false), `venue` (jsonb), `created_at` (timestamptz, default now())

Each venue keeps its own stock and PIN; saving flavors does not overwrite `admin_pin`.

### Telegram login checklist

1. Создайте бота в @BotFather и получите `VITE_TELEGRAM_BOT_ID` и `VITE_TELEGRAM_BOT_TOKEN`.
2. В настройках бота укажите домен, на котором открывается приложение, чтобы Telegram разрешил OAuth-авторизацию.
3. В Supabase создайте таблицу `user_mixes` (см. схему выше) и индекс по `user_id` для быстрых выборок:
   ```sql
   create index user_mixes_user_id_idx on public.user_mixes (user_id);
   ```
4. Заполните `.env.local` нужными переменными, затем выполните `npm run dev`.
5. После входа через Telegram история и избранные миксы сохраняются в `user_mixes` и доступны с любого устройства.
