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

/**
 * Retrieves the current Telegram user.
 * If running in a browser (dev mode), returns a mock user.
 */
export const getTelegramUser = (): TelegramUser => {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    return window.Telegram.WebApp.initDataUnsafe.user;
  }

  // Fallback/Mock user for browser development
  return {
    id: 999999,
    first_name: "Гость",
    username: "browser_user"
  };
};

export const isTelegramWebApp = (): boolean => {
    return !!(typeof window !== 'undefined' && window.Telegram?.WebApp?.initData);
};