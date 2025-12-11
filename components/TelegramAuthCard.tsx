import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { TelegramUser } from '../types';
import { persistTelegramUser } from '../services/telegramService';

type TelegramCallbackUser = TelegramUser & {
  photo_url?: string;
  hash: string;
  auth_date: string;
};

interface Props {
  onSuccess: (user: TelegramUser) => void;
  onError: (error: string) => void;
}

const TelegramAuthCard: React.FC<Props> = ({ onSuccess, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [widgetSeed, setWidgetSeed] = useState(0);
  const [lastError, setLastError] = useState('');

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;
  const httpsOnly = import.meta.env.VITE_TELEGRAM_HTTPS_ONLY !== 'false';
  const isSecure = typeof window !== 'undefined'
    ? !httpsOnly || window.location.protocol === 'https:'
    : true;

  const sanitizedUser = useMemo(() => (user: TelegramCallbackUser): TelegramUser => ({
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    language_code: user.language_code,
    photo_url: user.photo_url,
  }), []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!botUsername) {
      setLastError('TELEGRAM_BOT_USERNAME не настроен');
      onError('Телеграм-бот не настроен. Добавьте VITE_TELEGRAM_BOT_USERNAME.');
      return;
    }

    const handleAuth = (payload: TelegramCallbackUser) => {
      if (!isSecure) {
        const warning = 'Авторизация доступна только по HTTPS';
        setLastError(warning);
        onError(warning);
        return;
      }

      setIsProcessing(true);
      setLastError('');

      try {
        const user = sanitizedUser(payload);
        persistTelegramUser(user);
        onSuccess(user);
      } catch (e: any) {
        const message = e?.message || 'Не удалось обработать данные Telegram';
        setLastError(message);
        onError(message);
      } finally {
        setIsProcessing(false);
      }
    };

    (window as any).onTelegramAuth = handleAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?21';
    script.async = true;
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.userpic = 'true';
    script.dataset.radius = '8';
    script.dataset.requestAccess = 'write';
    script.dataset.onauth = 'onTelegramAuth(user)';

    const container = document.getElementById('telegram-login-widget');
    if (container) {
      container.innerHTML = '';
      container.appendChild(script);
    }

    return () => {
      delete (window as any).onTelegramAuth;
      if (container) container.innerHTML = '';
    };
  }, [botUsername, isSecure, onError, onSuccess, sanitizedUser, widgetSeed]);

  const handleReload = () => setWidgetSeed((prev) => prev + 1);

  return (
    <div className="flex flex-col items-start gap-2">
      <div id="telegram-login-widget" aria-live="polite" />
      {!isSecure && (
        <p className="text-xs text-amber-400">Для входа требуется HTTPS-домен</p>
      )}
      {lastError && (
        <p className="text-xs text-red-400" role="alert">{lastError}</p>
      )}
      <button
        type="button"
        onClick={handleReload}
        className="flex items-center gap-2 text-xs text-slate-300 hover:text-white"
        aria-label="Перезагрузить Telegram авторизацию"
        disabled={isProcessing}
      >
        <RefreshCcw size={14} />
        Попробовать снова
      </button>
    </div>
  );
};

export default TelegramAuthCard;
