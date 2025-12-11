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

Expected schema:

- `venues`: `id`, `title`, `city`, `logo`, `subscription_until`, `visible`, `admin_pin`, `flavor_schema`
- `flavors`: `id`, `venue_id`, `name`, `brand`, `description`, `color`, `is_available`
- `brands`: `name`, `venue_id`
- `clients`: `id`, `first_name`, `last_name`, `username`, `language_code`, `last_seen_at`
- `mixes`: `id`, `user_id`, `name`, `ingredients (jsonb)`, `is_favorite`, `venue_snapshot (jsonb)`, `created_at`

To enable Telegram Login Widget, provide the following environment variables:

- `TELEGRAM_BOT_TOKEN` – Bot token used by the `/api/auth/telegram/callback` endpoint
- `VITE_TELEGRAM_BOT_USERNAME` – Bot username displayed inside the Telegram button

Each venue keeps its own stock and PIN; saving flavors does not overwrite `admin_pin`.
