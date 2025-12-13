import { TelegramUser } from '../types';
import { apiFetch } from './apiClient';

interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Saves basic Telegram user info into Supabase so mixes can be linked to a known client.
 * Silently no-ops when the database is not configured in the current environment.
 */
export const syncTelegramClient = async (user: TelegramUser): Promise<SyncResult> => {
  try {
    await apiFetch('/clients', {
      method: 'POST',
      body: JSON.stringify({
        id: user.id,
        first_name: user.first_name ?? '',
        last_name: user.last_name ?? null,
        username: user.username ?? null,
        language_code: user.language_code ?? null,
      }),
    });

    return { success: true };
  } catch (e: any) {
    console.error('[telegram-auth] Failed to sync client', e);
    return { success: false, error: e?.message || 'Не удалось сохранить профиль' };
  }
};
