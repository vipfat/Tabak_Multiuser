# Архитектура системы "Кальянный Алхимик"

## Обзор

Двухуровневая система для управления кальянными заведениями и создания миксов табака.

## Пользовательские роли

### 1. Владельцы заведений (Venue Owners)
- **Авторизация**: Email + пароль + JWT
- **Интерфейс**: Личный кабинет (веб)
- **Функционал**:
  - Регистрация и подключение заведения
  - Управление профилем заведения
  - Управление вкусами и брендами табака
  - Просмотр статистики популярных миксов
  - Управление подпиской

### 2. Клиенты заведений (End Users)
- **Авторизация**: Telegram Widget (существующая)
- **Интерфейс**: PWA приложение через Telegram
- **Функционал**:
  - Выбор заведения
  - Создание миксов табака
  - Сохранение истории миксов
  - Просмотр избранных рецептов

## Структура БД

### Новые таблицы

#### `venue_owners` - Владельцы заведений
```sql
CREATE TABLE venue_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `venue_applications` - Заявки на подключение
```sql
CREATE TABLE venue_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id),
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `owner_sessions` - JWT сессии
```sql
CREATE TABLE owner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES venue_owners(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Модификация существующих таблиц

#### `venues` - добавить связь с владельцем
```sql
ALTER TABLE venues ADD COLUMN owner_id UUID REFERENCES venue_owners(id);
ALTER TABLE venues ADD COLUMN slug VARCHAR(255) UNIQUE;
ALTER TABLE venues ADD COLUMN bowl_capacity INTEGER DEFAULT 18;
ALTER TABLE venues ADD COLUMN allow_brand_mixing BOOLEAN DEFAULT true;
```

## API Endpoints

### Авторизация владельцев

- `POST /api/auth/register` - Регистрация нового владельца
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/logout` - Выход (инвалидация токена)
- `POST /api/auth/refresh` - Обновление access токена
- `POST /api/auth/verify-email` - Подтверждение email
- `POST /api/auth/forgot-password` - Запрос сброса пароля
- `POST /api/auth/reset-password` - Сброс пароля

### Личный кабинет владельца

- `GET /api/owner/profile` - Профиль владельца
- `PATCH /api/owner/profile` - Обновление профиля
- `GET /api/owner/venues` - Список заведений владельца
- `POST /api/owner/venues` - Создание заявки на подключение
- `GET /api/owner/venues/:id` - Детали заведения
- `PATCH /api/owner/venues/:id` - Обновление заведения
- `GET /api/owner/venues/:id/stats` - Статистика заведения
- `DELETE /api/owner/venues/:id` - Удаление заведения

### Существующие endpoints (для клиентов)

- `GET /api/venues` - Публичный список активных заведений
- `GET /api/flavors?venueId=...` - Вкусы заведения
- `POST /api/mixes` - Создание микса
- `GET /api/mixes?userId=...` - История миксов
- И т.д.

## Безопасность

### Хэширование паролей
- **Алгоритм**: bcrypt
- **Salt rounds**: 10

### JWT Токены
- **Access token**: 15 минут
- **Refresh token**: 7 дней
- **Алгоритм**: HS256 (можно перейти на RS256 для продакшена)

### Защита endpoints
- Middleware для проверки JWT
- Rate limiting для auth endpoints
- CORS настроен корректно

## UX Flow

### Для владельца заведения

1. **Регистрация**
   - Форма: Email, пароль, имя, телефон
   - Подтверждение email (опционально для MVP)
   - Перенаправление в ЛК

2. **Подключение заведения**
   - Форма заявки: Название, город, адрес, описание
   - Статус: "На рассмотрении"
   - После одобрения: доступ к настройкам

3. **Настройка заведения**
   - Загрузка лого
   - Добавление вкусов и брендов
   - Настройка параметров (вместимость чаши, смешивание брендов)
   - Генерация уникального slug для ссылки

4. **Мониторинг**
   - Просмотр статистики популярных миксов
   - Управление активностью вкусов

### Для клиента (без изменений)

1. Открывает ссылку заведения или выбирает из списка
2. Авторизуется через Telegram
3. Создает миксы табака
4. Сохраняет в историю

## Технический стек

### Backend
- Node.js + Express
- PostgreSQL
- bcrypt (хэширование)
- jsonwebtoken (JWT)
- pg (PostgreSQL драйвер)

### Frontend
- React + TypeScript
- TailwindCSS
- Lucide React (иконки)
- Существующие компоненты

## Фазы внедрения

### Фаза 1: Backend основа
1. Создать новые таблицы БД
2. Реализовать auth endpoints
3. Реализовать owner endpoints
4. Добавить JWT middleware

### Фаза 2: Frontend ЛК
1. Компоненты регистрации/логина
2. Dashboard владельца
3. Форма подключения заведения
4. Управление заведением

### Фаза 3: Интеграция
1. Связать существующую систему venues с owners
2. Миграция данных (если нужно)
3. Тестирование

### Фаза 4: Полировка
1. Email уведомления
2. Аналитика и статистика
3. Система подписок (опционально)

## Что НЕ меняется

- Telegram авторизация для клиентов
- Функционал создания миксов
- Существующие таблицы clients, mixes
- PWA функционал для клиентов
