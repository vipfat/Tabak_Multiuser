// telegramService.ts
const AUTH_PATH = '/api/auth/telegram/callback';

const runtimeOrigin = typeof window !== 'undefined' ? window.location.origin : '';
const backendBase = (import.meta.env.VITE_BACKEND_URL || runtimeOrigin || '').replace(/\/$/, '');
const authEndpoint = `${backendBase}${AUTH_PATH}`;

export function getTelegramAuthUrl() {
  return authEndpoint;
}

export async function submitTelegramProfile(payload: Record<string, any>) {
  const response = await fetch(authEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = 'Не удалось подтвердить Telegram-профиль';
    try {
      const error = await response.json();
      if (error?.error) message = error.error;
      else if (error?.message) message = error.message;
    } catch (e) {
      try {
        const text = await response.text();
        if (text) message = `${message}: ${text}`;
      } catch (readError) {
        // ignore
      }
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (data?.user) {
    localStorage.setItem('telegram_web_user', JSON.stringify(data.user));
  }
  if (data?.token) {
    localStorage.setItem('telegram_session_token', data.token);
  }

  window.postMessage(
    { source: 'telegram-auth', user: data?.user, token: data?.token },
    window.location.origin,
  );

  return data;
}

export function startTelegramLogin() {
  if (typeof document === 'undefined') return;
  const widget = document.getElementById('telegram-login-widget');
  if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// Возвращаем пользователя из localStorage
export async function resolveTelegramUser() {
  try {
    const raw = localStorage.getItem("telegram_web_user");
    if (!raw) return { user: null, error: null };

    const user = JSON.parse(raw);
    return { user, error: null };
  } catch (e) {
    return { user: null, error: "Ошибка чтения профиля" };
  }
}


// Logout
export function logoutTelegramUser() {
  localStorage.removeItem("telegram_web_user");
  localStorage.removeItem('telegram_session_token');
}
