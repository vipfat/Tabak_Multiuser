# API Documentation

## Об API странице `/api`

**Проблема:** При доступе к `https://hookahmix.ru/api` возвращается ошибка 301 (редирект).

**Почему это происходит:**
- `/api/` — это prefix для API endpoints, который nginx проксирует на Express API (localhost:3000)
- `/api` без слеша в конце nginx перенаправляет на `/api/` (редирект 301)
- Это нормальное поведение — REST API не имеет HTML страницы с документацией

**Зачем нужна страница API (документация):**
В идеале, для удобства разработчиков, нужна документация API по адресу `/api/docs` или `/api-docs`. Но текущая реализация это не содержит.

## Доступные API Endpoints

### Owner Authentication

#### POST `/api/auth/register`
Регистрация нового владельца заведения.

**Request:**
```json
{
  "email": "owner@example.com",
  "password": "SecurePassword123",
  "fullName": "Иван Иванов",
  "phone": "+7 999 123 45 67"
}
```

**Response:**
```json
{
  "success": true,
  "owner": {
    "id": 1,
    "email": "owner@example.com",
    "fullName": "Иван Иванов",
    "phone": "+7 999 123 45 67",
    "emailVerified": false
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "c06f2e1a..."
}
```

#### POST `/api/auth/login`
Вход владельца в систему.

**Request:**
```json
{
  "email": "owner@example.com",
  "password": "SecurePassword123"
}
```

**Response:** (аналогично register)

#### POST `/api/auth/refresh`
Обновление access token используя refresh token.

**Request:**
```json
{
  "refreshToken": "c06f2e1a..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "new_refresh_token..."
}
```

#### GET `/api/auth/me`
Получить данные текущего владельца.

**Headers:**
```
Authorization: Bearer <accessToken>
```

**Response:**
```json
{
  "id": 1,
  "email": "owner@example.com",
  "fullName": "Иван Иванов",
  "phone": "+7 999 123 45 67",
  "emailVerified": false
}
```

#### POST `/api/auth/logout`
Выход из системы (инвалидирует refresh token).

**Headers:**
```
Authorization: Bearer <accessToken>
```

### Owner Profile

#### GET `/api/owner/profile`
Получить полный профиль владельца.

**Headers:**
```
Authorization: Bearer <accessToken>
```

#### PATCH `/api/owner/profile`
Обновить данные профиля.

**Request:**
```json
{
  "fullName": "Новое Имя",
  "phone": "+7 999 987 65 43"
}
```

### Owner Venues

#### GET `/api/owner/venues`
Получить все заведения владельца.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Кальянная Релакс",
    "city": "Москва",
    "address": "ул. Примерная, д.1",
    "slug": "relax-kalhyan",
    "visible": true,
    "created_at": "2025-12-16T12:00:00Z"
  }
]
```

#### GET `/api/owner/venues/:id`
Получить данные конкретного заведения.

#### PATCH `/api/owner/venues/:id`
Обновить заведение.

**Request:**
```json
{
  "title": "Новое название",
  "address": "Новый адрес",
  "bowl_capacity": 20,
  "allow_brand_mixing": false
}
```

#### DELETE `/api/owner/venues/:id`
Удалить заведение (мягкое удаление - устанавливает visible=false).

#### GET `/api/owner/venues/:id/stats`
Получить статистику заведения.

**Response:**
```json
{
  "totalMixes": 150,
  "uniqueUsers": 45,
  "popularFlavors": [
    { "name": "Pinkman", "count": 23 },
    { "name": "Cola", "count": 18 }
  ],
  "recentActivity": [...]
}
```

### Venue Applications

#### POST `/api/owner/applications`
Создать заявку на подключение нового заведения.

**Request:**
```json
{
  "venueName": "Кальянная Дым",
  "city": "Санкт-Петербург",
  "address": "Невский пр., д. 50",
  "phone": "+7 812 123 45 67",
  "email": "venue@example.com",
  "description": "Премиум заведение с лучшим сервисом"
}
```

**Response:**
```json
{
  "success": true,
  "application": {
    "id": 1,
    "owner_id": 1,
    "venue_name": "Кальянная Дым",
    "city": "Санкт-Петербург",
    "status": "pending",
    "created_at": "2025-12-16T12:00:00Z"
  }
}
```

#### GET `/api/owner/applications`
Получить все заявки владельца.

**Response:**
```json
[
  {
    "id": 1,
    "venue_name": "Кальянная Дым",
    "city": "Санкт-Петербург",
    "status": "pending",
    "admin_notes": null,
    "created_at": "2025-12-16T12:00:00Z"
  }
]
```

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | OK - успешный запрос |
| 201 | Created - ресурс создан |
| 400 | Bad Request - ошибка в данных |
| 401 | Unauthorized - не авторизован |
| 403 | Forbidden - нет доступа |
| 404 | Not Found - ресурс не найден |
| 500 | Server Error - ошибка сервера |

## Authentication

Все защищённые endpoints требуют заголовок:
```
Authorization: Bearer <accessToken>
```

Access token валиден 15 минут. После истечения используйте refresh token для получения нового.

## Testing

В личном кабинете владельца добавлена кнопка "API" для тестирования endpoints:
- Откройте https://hookahmix.ru/owner
- Нажмите кнопку "API" в правом верхнем углу
- Выберите endpoint и нажмите "Запустить"
- Посмотрите статус и ответ

## Future: API Documentation UI

Для удобства разработчиков рекомендуется добавить:
- Swagger/OpenAPI документацию на `/api/docs`
- Interactive API explorer
- SDK для популярных языков программирования
