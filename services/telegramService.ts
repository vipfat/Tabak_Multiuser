// telegramService.ts
export function startTelegramLogin() {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

  const url = `https://oauth.telegram.org/auth?bot_id=${import.meta.env.VITE_TELEGRAM_BOT_ID
    }&origin=${encodeURIComponent(window.location.origin)}&embed=1&request_access=write`;

  const authWindow = window.open(
    url,
    "_blank",
    "width=500,height=700"
  );

  const listener = (event: MessageEvent) => {
    if (event.origin !== "https://oauth.telegram.org") return;

    const data = event.data;

    if (data.user) {
      // Сохранить в localStorage
      localStorage.setItem("telegram_web_user", JSON.stringify(data.user));

      // Передать App.tsx
      window.postMessage(
        { source: "telegram-auth", user: data.user },
        window.location.origin
      );
    }

    if (data.error) {
      window.postMessage(
        { source: "telegram-auth", error: data.error },
        window.location.origin
      );
    }

    window.removeEventListener("message", listener);
    authWindow?.close();
  };

  window.addEventListener("message", listener);
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
}
