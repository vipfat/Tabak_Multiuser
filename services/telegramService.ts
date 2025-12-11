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
  const envAuthUrl = import.meta.env.VITE_TELEGRAM_AUTH_URL;
  if (envAuthUrl) {
    try {
      const base = envAuthUrl.startsWith('http')
        ? envAuthUrl
        : typeof window !== 'undefined'
          ? new URL(envAuthUrl, window.location.origin).toString()
          : new URL(envAuthUrl, 'http://localhost').toString();

      const url = new URL(base);
      if (!url.pathname.endsWith(AUTH_PATH)) {
        url.pathname = AUTH_PATH;
      }
      return url.toString();
    } catch (e) {
      console.warn('Failed to normalize VITE_TELEGRAM_AUTH_URL, using raw value', e);
      return envAuthUrl;
    }
  }

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

const requestTelegramSession = async (url: string, payload: any, method: 'POST' | 'GET') => {
  const options: RequestInit = { method };

  if (method === 'POST') {
    options.headers = { 'content-type': 'application/json' };
    options.body = JSON.stringify(payload);
  } else {
    const urlWithParams = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        urlWithParams.searchParams.set(key, String(value));
      }
    });
    url = urlWithParams.toString();
  }

  const response = await fetch(url, options);
  return response;
};

export const submitTelegramProfile = async (payload: any) => {
  const url = getTelegramAuthUrl();

  const attempt = async (method: 'POST' | 'GET') => {
    const response = await requestTelegramSession(url, payload, method);
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();

    if (!response.ok) {
      const error = body || 'Не удалось пройти авторизацию';
      return { ok: false, error, response } as const;
    }

    if (!contentType.includes('application/json')) {
      const error =
        body ||
        'Не удалось разобрать ответ авторизации. Проверьте, что эндпоинт возвращает JSON и не проксируется в HTML-страницу.';
      return { ok: false, error, response } as const;
    }

    try {
      const json = JSON.parse(body);
      return { ok: true, json } as const;
    } catch (error) {
      const message =
        body || (error as Error)?.message || 'Не удалось разобрать ответ авторизации из JSON.';
      return { ok: false, error: message, response } as const;
    }
  };

  let result = await attempt('POST');

  // Some hosts (static nginx) reject POST with 405. Try GET fallback for compatibility.
  if (!result.ok && result.response?.status === 405) {
    result = await attempt('GET');
  }

  if (!result.ok) {
    const hint =
      'Убедитесь, что переменная VITE_TELEGRAM_AUTH_URL указывает на работающий сервер /api/auth/telegram/callback';
    throw new Error(`${result.error}. ${hint}`);
  }

  if (result.json?.user && result.json?.token) {
    persistTelegramSession(result.json.user, result.json.token);
  }
  return result.json;
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
