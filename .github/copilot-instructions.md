# Кальянный Алхимик - Инструкции для AI агентов

## Архитектура проекта

Двухуровневая система управления кальянными заведениями с созданием табачных миксов:
- **Владельцы заведений**: Аутентификация JWT (email + пароль), управление заведениями через [components/OwnerDashboard.tsx](../components/OwnerDashboard.tsx)
- **Клиенты**: Аутентификация через Telegram Widget, создание миксов через [App.tsx](../App.tsx)

### Роли и границы доступа
- Владельцы (venue owners) → `/api/owner/*` + `/api/auth/*` endpoints
- Клиенты → `/api/venues`, `/api/flavors`, `/api/mixes`, `/api/clients` endpoints
- SuperAdmin роль (опционально) → `/api/admin/*` endpoints для управления всеми владельцами

## Структура базы данных

PostgreSQL с 7 основными таблицами (см. [create-tables.sql](../create-tables.sql)):
- `venue_owners` - владельцы с bcrypt хэшированными паролями
- `owner_sessions` - JWT refresh токены (7 дней TTL)
- `venues` - заведения с `owner_id` FK, включая `flavor_schema` (JSONB для пользовательских схем вкусов)
- `flavors` - вкусы табака с FK на `venue_id`
- `brands` - бренды табака (venue-specific)
- `clients` - пользователи Telegram
- `mixes` - сохранённые миксы с `venue_snapshot` (JSONB для хранения состояния venue на момент создания)

**Важно**: Таблица `venues` использует колонку `title` (не `name`) и поддерживает `flavor_schema` как JSONB для динамической конфигурации вкусов.

## Backend API ([server/api.js](../server/api.js))

### Middleware и безопасность
- JWT middleware в [server/authMiddleware.js](../server/authMiddleware.js) - проверяет `Authorization: Bearer <token>`
- Access token: 15 минут, Refresh token: 7 дней
- Telegram auth в [server/telegramAuth.js](../server/telegramAuth.js) - валидирует HMAC подпись от Telegram
- Environment variables: `JWT_SECRET` (обязательно!), `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`

### Паттерны работы с БД
```javascript
// Всегда используй connection pool, не прямое подключение
const { pool } = req.app.locals;
const client = await pool.connect();
try {
  // Queries здесь
} finally {
  client.release();
}
```

### Роутинг
- `createAuthRouter(pool)` - регистрация/логин/logout владельцев
- `createOwnerRouter(pool)` - CRUD venues и applications (требует JWT)
- Прямые endpoints в `api.js` - публичные venues, flavors, mixes, telegram auth

## Frontend

### Две отдельные сборки (Vite)
- **Клиентское приложение**: [index.html](../index.html) → [App.tsx](../App.tsx) → деплоится в `/app/`
- **Личный кабинет владельца**: [owner.html](../owner.html) → [OwnerApp.tsx](../OwnerApp.tsx) → деплоится в `/owner/`
- [vite.config.ts](../vite.config.ts) настроен для multi-page build с разными base paths

### Управление состоянием
React useState/useEffect без внешних state managers. API вызовы через:
- [services/apiClient.ts](../services/apiClient.ts) - базовый HTTP client с JWT handling
- [services/venueService.ts](../services/venueService.ts) - venues CRUD
- [services/clientService.ts](../services/clientService.ts) - Telegram clients sync
- [services/storageService.ts](../services/storageService.ts) - localStorage для mixов/истории

### Особенности UI
- TailwindCSS с кастомной темой (`#0B0F1D`, `#121629`, `#10B981`)
- Plus Jakarta Sans шрифт (подключен через Google Fonts в HTML)
- Lucide React для иконок
- Recharts для графиков в [components/BowlChart.tsx](../components/BowlChart.tsx)

## Команды разработки

```bash
# Локальная разработка
npm install
npm run dev       # Frontend dev server (порт 3000, Vite)
npm run api       # Backend API server (порт 3000, Express)

# Сборка для продакшена
npm run build     # Создаёт dist/ с обоими приложениями + запускает fix-owner-paths.sh

# Деплой на продакшен (hookahmix.ru)
./deploy.sh       # Пакует и загружает на сервер, перезапускает PM2
```

**Важно**: Для локальной разработки запускай `npm run dev` и `npm run api` в отдельных терминалах.

## Деплой на продакшен

Сервер: `hookahmix.ru` (nginx + PM2), см. [DEPLOY.md](../DEPLOY.md):
- Frontend: статика в `/home/tabakapp/apps/tabak_multiuser/dist/`
- Backend: PM2 процесс `tabak-api` (`node server/api.js`)
- База данных: PostgreSQL на localhost с `DATABASE_URL` в `.env`
- Nginx конфигурация: проксирует `/api/*` → `localhost:3000`, статика `/app/` и `/owner/`

### Критические шаги при деплое
1. Проверь миграции БД перед обновлением кода
2. Бэкап `dist/` и `server/` перед заменой
3. После деплоя: `pm2 restart tabak-api` и проверь `pm2 logs tabak-api`

## Паттерны и конвенции

### TypeScript типы ([types.ts](../types.ts))
- `Flavor` - вкус с динамическим `brand: string` (не enum)
- `MixIngredient extends Flavor` - добавляет `grams` и `isMissing?`
- `SavedMix` - хранит `venue_snapshot` для отображения исторических данных

### Обработка ошибок
- API всегда возвращает `{ error: string }` при ошибках
- Frontend показывает user-friendly сообщения через UI state
- Логирование: `console.error('[api] ...')` для backend, `console.error('Failed to ...')` для frontend

### Telegram интеграция
- Используй [services/telegramService.ts](../services/telegramService.ts) для работы с Telegram WebApp API
- Callback endpoint: `/api/auth/telegram/callback` (GET и POST)
- Проверка подписи через `validateTelegramPayload()` в [server/telegramAuth.js](../server/telegramAuth.js)

## Тестирование

Минимальные тесты в [tests/telegramAuth.test.js](../tests/telegramAuth.test.js). Запускай через:
```bash
node --test
```

**Нет** интеграционных или E2E тестов - ручное тестирование через `/api/test` endpoint.

## Специфичные проблемы и решения

1. **Telegram auth через HTTPS**: Установи `VITE_TELEGRAM_HTTPS_ONLY=false` для локальной разработки
2. **CORS проблемы**: API настроен с `cors()` middleware, проверь `Access-Control-Allow-Origin` в response headers
3. **JWT refresh**: Frontend автоматически обновляет токен через `/api/auth/refresh` перед истечением
4. **Nginx 301 редирект на `/api`**: Это нормально, API endpoints требуют полный путь (`/api/venues`, не `/api`)

## Важные файлы для модификации

- Добавление нового endpoint владельца → [server/ownerRoutes.js](../server/ownerRoutes.js)
- Изменение схемы БД → [create-tables.sql](../create-tables.sql) + миграция в продакшене
- UI компонент для владельца → [components/OwnerDashboard.tsx](../components/OwnerDashboard.tsx)
- Новый тип данных → [types.ts](../types.ts)
- Конфигурация сборки → [vite.config.ts](../vite.config.ts)
