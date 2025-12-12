// telegramService.ts
import { TelegramUser } from '../types';

const STORAGE_USER_KEY = 'telegram_web_user';

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

export const persistTelegramUser = (user: TelegramUser) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
};

export const getTelegramUser = (): TelegramUser | null => {
  if (typeof window !== 'undefined') {
    try {
      const rawUser = localStorage.getItem(STORAGE_USER_KEY);
      if (rawUser) {
        const storedUser = JSON.parse(rawUser) as TelegramUser;
        if (storedUser?.id) return storedUser;
      }
    } catch (e) {
      console.warn('Failed to restore Telegram user from localStorage', e);
    }

    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      return window.Telegram.WebApp.initDataUnsafe.user;
    }
  }

  return null;
};

// Logout
export function logoutTelegramUser() {
  localStorage.removeItem(STORAGE_USER_KEY);
}
