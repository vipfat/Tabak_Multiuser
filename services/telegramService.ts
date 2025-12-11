// telegramService.ts
import { TelegramUser } from '../types';

const AUTH_PATH = '/api/auth/telegram/callback';
const STORAGE_USER_KEY = 'telegram_web_user';
const STORAGE_TOKEN_KEY = 'telegram_session_token';

declare global {
  interface Window {
    Telegram: {
      WebApp: {
        initData: string;
        initDataUnsafe: {
          user?: TelegramUser;
          start_param?: string;
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
            text: string;
            show: () => void;
            hide: () => void;
            onClick: (cb: () => void) => void;
        }
        themeParams: any;
        isExpanded: boolean;
        viewportHeight: number;
      };
    };
  }
}

/**
 * Retrieves the current Telegram user.
 * If running in a browser (dev mode), returns a mock user.
 */
export const getTelegramAuthUrl = () => {
  if (import.meta.env.VITE_TELEGRAM_AUTH_URL) return import.meta.env.VITE_TELEGRAM_AUTH_URL;
  if (typeof window === 'undefined') return AUTH_PATH;
  return `${window.location.origin}${AUTH_PATH}`;
};

export const persistTelegramSession = (user: TelegramUser, token: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  localStorage.setItem(STORAGE_TOKEN_KEY, token);
};

export const restoreTelegramSession = (): { user: TelegramUser; token: string } | null => {
  if (typeof window === 'undefined') return null;
  try {
    const rawUser = localStorage.getItem(STORAGE_USER_KEY);
    const token = localStorage.getItem(STORAGE_TOKEN_KEY);
    if (!rawUser || !token) return null;
    const user = JSON.parse(rawUser) as TelegramUser;
    if (!user?.id) return null;
    return { user, token };
  } catch (e) {
    console.warn('Failed to restore Telegram session', e);
    return null;
  }
};

export const submitTelegramProfile = async (payload: any) => {
  const url = getTelegramAuthUrl();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Не удалось пройти авторизацию');
  }

  const json = await response.json();
  if (json?.user && json?.token) {
    persistTelegramSession(json.user, json.token);
  }
  return json;
};

export const getTelegramUser = (): TelegramUser | null => {
  const session = restoreTelegramSession();
  if (session?.user) return session.user;

  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    return window.Telegram.WebApp.initDataUnsafe.user;
  }

  return null;
};

// Logout
export function logoutTelegramUser() {
  localStorage.removeItem(STORAGE_USER_KEY);
  localStorage.removeItem(STORAGE_TOKEN_KEY);
}
