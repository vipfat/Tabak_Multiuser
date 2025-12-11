import { TelegramUser } from '../types';

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

const TELEGRAM_BOT_ID = import.meta.env.VITE_TELEGRAM_BOT_ID;
const TELEGRAM_BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const AUTH_STORAGE_KEY = 'telegram_web_user';

const bufferToHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

const sha256 = async (data: string): Promise<ArrayBuffer> => {
  const enc = new TextEncoder();
  return crypto.subtle.digest('SHA-256', enc.encode(data));
};

const validateTelegramAuth = async (params: URLSearchParams): Promise<boolean> => {
  if (!TELEGRAM_BOT_TOKEN) return false;

  const receivedHash = params.get('hash');
  if (!receivedHash) return false;

  const dataToCheck = Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = await sha256(TELEGRAM_BOT_TOKEN);
  const key = await crypto.subtle.importKey('raw', secretKey, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToCheck));
  const hex = bufferToHex(signature);

  return hex === receivedHash;
};

const parseHashAuthParams = (): URLSearchParams | null => {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash || '';
  const match = hash.match(/tgAuthResult=([^&]+)/);
  if (!match?.[1]) return null;

  try {
    const raw = decodeURIComponent(match[1]);
    const parsed = JSON.parse(raw);
    const params = new URLSearchParams();
    Object.entries(parsed).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.set(key, String(value));
      }
    });
    return params;
  } catch (e) {
    console.error('Failed to parse tgAuthResult hash', e);
    return null;
  }
};

const getCachedUser = (): TelegramUser | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TelegramUser) : null;
  } catch (e) {
    return null;
  }
};

const persistUser = (user: TelegramUser) => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch (e) {
    // ignore
  }
};

const parseUserFromParams = (params: URLSearchParams): TelegramUser | null => {
  if (!params.get('id')) return null;
  return {
    id: Number(params.get('id')),
    first_name: params.get('first_name') || 'Пользователь',
    last_name: params.get('last_name') || undefined,
    username: params.get('username') || undefined,
    language_code: params.get('language_code') || undefined,
  };
};

export const buildTelegramAuthUrl = (redirectUri?: string): string | null => {
  if (!TELEGRAM_BOT_ID || typeof window === 'undefined') return null;

  const redirect = redirectUri || window.location.href;
  const origin = window.location.origin;

  const base = new URL('https://oauth.telegram.org/auth');
  base.searchParams.set('bot_id', TELEGRAM_BOT_ID);
  base.searchParams.set('origin', origin);
  base.searchParams.set('request_access', 'write');
  base.searchParams.set('embed', '1');
  base.searchParams.set('redirect_uri', redirect);

  return base.toString();
};

/**
 * Retrieves the current Telegram user by prioritizing embedded WebApp data,
 * then OAuth callback parameters, and finally cached session data.
 */
export const resolveTelegramUser = async (): Promise<{ user: TelegramUser | null; error?: string }> => {
  if (typeof window === 'undefined') return { user: null };

  if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    return { user: window.Telegram.WebApp.initDataUnsafe.user };
  }

  const params = new URLSearchParams(window.location.search);
  const hashParams = parseHashAuthParams();
  const authParams = hashParams?.get('id') ? hashParams : params;

  if (authParams.get('id') && authParams.get('hash')) {
    const isValid = await validateTelegramAuth(authParams);
    if (!isValid) {
      return { user: getCachedUser(), error: 'Не удалось подтвердить подлинность ответа Telegram' };
    }

    const parsed = parseUserFromParams(authParams);
    if (parsed) {
      persistUser(parsed);
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
      return { user: parsed };
    }
  }

  return { user: getCachedUser() };
};

export const startTelegramLogin = () => {
  if (typeof window === 'undefined') return;
  const url = buildTelegramAuthUrl();
  if (!url) {
    alert('Bot ID не настроен. Проверьте переменную VITE_TELEGRAM_BOT_ID');
    return;
  }

  const popup = window.open(url, '_blank', 'width=420,height=720');
  if (!popup) {
    window.location.href = url;
  }
};

export const logoutTelegramUser = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
};

export const isTelegramWebApp = (): boolean => {
    return !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData);
};