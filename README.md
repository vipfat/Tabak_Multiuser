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

The app now uses a local PostgreSQL instance instead of Supabase. Provide the following environment variables before running. The API automatically loads `.env.local` first (then `.env`) when you start it with `npm run api`:

- `DATABASE_URL` – connection string to PostgreSQL, e.g. `postgresql://tabakapp:PASS@localhost:5432/appdb`
- `VITE_API_BASE_URL` – base URL for API calls from the frontend (defaults to `/api` when both frontend and API are served together)

Start the API server locally with `npm run api`. It exposes REST endpoints under `/api/*` for venues, flavors, brands, mixes, and clients.

Expected schema:

- `venues`: `id`, `title`, `city`, `logo`, `subscription_until`, `visible`, `admin_pin`, `flavor_schema`
- `flavors`: `id`, `venue_id`, `name`, `brand`, `description`, `color`, `is_available`
- `brands`: `name`, `venue_id`
- `clients`: `id`, `first_name`, `last_name`, `username`, `language_code`, `last_seen_at`
- `mixes`: `id`, `user_id`, `name`, `ingredients (jsonb)`, `is_favorite`, `venue_snapshot (jsonb)`, `created_at`

To enable Telegram Login Widget, provide the following environment variables:

- `TELEGRAM_BOT_TOKEN` – Bot token used by the `/api/auth/telegram/callback` endpoint
- `VITE_TELEGRAM_BOT_USERNAME` – Bot username displayed inside the Telegram button
- `VITE_TELEGRAM_HTTPS_ONLY` – set to `false` to allow Telegram login over HTTP during local development

`VITE_TELEGRAM_AUTH_URL` must point to a reachable server that handles `POST`/`GET` on `/api/auth/telegram/callback`. If you set
only a base domain in the variable, the app will automatically append `/api/auth/telegram/callback` for you.

If your hosting forbids POST requests to the callback path (e.g., static nginx), point `VITE_TELEGRAM_AUTH_URL` to a server that
handles `GET`/`POST` on `/api/auth/telegram/callback` (you can run `node server/telegramAuth.js` locally or deploy it as a separ
ate function).

Each venue keeps its own stock and PIN; saving flavors does not overwrite `admin_pin`.
