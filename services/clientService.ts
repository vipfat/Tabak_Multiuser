import { TelegramUser } from '../types';
import { getDatabaseClient, isDatabaseConfigured } from './supabaseClient';

const CLIENTS_TABLE = 'clients';

interface SyncResult {
  success: boolean;
  error?: string;
}

/**
 * Saves basic Telegram user info into Supabase so mixes can be linked to a known client.
 * Silently no-ops when the database is not configured in the current environment.
 */
export const syncTelegramClient = async (user: TelegramUser): Promise<SyncResult> => {
  if (!isDatabaseConfigured()) return { success: true };

  const client = getDatabaseClient();
  if (!client) return { success: false, error: 'База данных недоступна' };

  try {
    const payload = {
      id: user.id,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? null,
      username: user.username ?? null,
      language_code: user.language_code ?? null,
      last_seen_at: new Date().toISOString(),
    };

    const { error } = await client.from(CLIENTS_TABLE).upsert(payload, { onConflict: 'id' });

    if (error) {
      // 42P01 – undefined table (clients table missing)
      if ((error as any)?.code === '42P01') {
        return {
          success: false,
          error: 'Создайте таблицу clients в Supabase, чтобы сохранять учетные записи пользователей',
        };
      }

      // 42501 – RLS violation (policies not configured for anon key)
      if ((error as any)?.code === '42501') {
        return {
          success: false,
          error: 'Supabase отверг вставку в clients: разрешите insert/upsert для анонимного ключа или используйте сервисный ключ',
        };
      }

      throw error;
    }

    return { success: true };
  } catch (e: any) {
    console.error('[telegram-auth] Failed to sync client', e);
    return { success: false, error: e?.message || 'Не удалось сохранить профиль' };
  }
};
