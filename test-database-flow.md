# Тестирование потоков данных в HookahMix

## Текущее состояние БД

```bash
Таблицы: venues (2), clients (1), flavors (0), mixes (1), brands (0)
```

## 1. Лендинг (https://hookahmix.ru/)

**Цель:** Информационная страница, привлечение заведений

**Действия для теста:**
- Проверить наличие формы регистрации заведения
- Если есть - заполнить и отправить
- Проверить запись в `venue_applications`

**SQL проверка:**
```sql
SELECT * FROM venue_applications ORDER BY created_at DESC LIMIT 5;
```

---

## 2. Приложение для посетителей (https://hookahmix.ru/app/)

### 2.1. Telegram авторизация

**Действие:** Войти через Telegram
**Таблица:** `clients`

**Проверка:**
```sql
SELECT id, first_name, last_name, username, last_seen_at 
FROM clients 
ORDER BY last_seen_at DESC;
```

**Что должно произойти:**
- При первом входе создается запись с Telegram ID
- При повторном - обновляется `last_seen_at`

### 2.2. Выбор заведения

**Действие:** Выбрать заведение из списка (id=1 или id=2)
**Таблица:** Не сохраняется в БД, только в localStorage

### 2.3. Создание микса

**Действие:** 
1. Добавить вкусы в чашу (если есть вкусы в базе)
2. Нажать "Сохранить микс"
3. Ввести название

**Таблица:** `mixes`

**Проверка:**
```sql
SELECT m.id, m.name, m.user_id, c.first_name, m.is_favorite, m.created_at
FROM mixes m
JOIN clients c ON m.user_id = c.id
ORDER BY m.created_at DESC;
```

**Структура ingredients (JSONB):**
```json
[
  {"flavorId": "uuid", "name": "Название", "brand": "Бренд", "percentage": 25},
  ...
]
```

### 2.4. Отметка микса как избранное

**Действие:** Нажать ⭐ на миксе
**Таблица:** `mixes.is_favorite`

**API:** `POST /api/mixes/:id/favorite`
**Body:** `{value: true/false, userId: <telegram_id>}`

**Проверка:**
```sql
SELECT name, is_favorite FROM mixes WHERE user_id = <your_telegram_id>;
```

---

## 3. Админ-панель (в приложении, через секретный PIN)

**Доступ:** В приложении 5 раз кликнуть по логотипу → ввести PIN

**PIN заведения можно установить через:**
```sql
UPDATE venues SET admin_pin = '1234' WHERE id = 1;
```

### 3.1. Добавление вкуса

**Действие:**
1. Войти в админку
2. Вкладка "Добавить вкус"
3. Заполнить: название, бренд, описание, цвет
4. Сохранить

**Таблица:** `flavors`

**Проверка:**
```sql
SELECT id, name, brand, description, color, is_available, venue_id 
FROM flavors 
ORDER BY created_at DESC;
```

### 3.2. Добавление бренда

**Действие:**
1. Админка → Вкладка "Бренды"
2. Ввести название бренда
3. Добавить

**Таблица:** `brands`

**Проверка:**
```sql
SELECT name, venue_id FROM brands ORDER BY name;
```

### 3.3. Изменение доступности вкуса

**Действие:**
1. Админка → Вкладка "Склад"
2. Переключить toggle "В наличии" для вкуса

**Таблица:** `flavors.is_available`

**API:** `PUT /api/flavors/:id`

**Проверка:**
```sql
SELECT name, is_available FROM flavors WHERE venue_id = 1;
```

### 3.4. Настройки заведения

**Действие:**
1. Админка → Вкладка "Настройки"
2. Изменить размер чаши (bowl_capacity)
3. Включить/выключить смешивание брендов

**Таблица:** `venues.bowl_capacity`, `venues.allow_brand_mixing`

**Проверка:**
```sql
SELECT id, title, bowl_capacity, allow_brand_mixing FROM venues;
```

---

## 4. Личный кабинет владельца (https://hookahmix.ru/owner)

### 4.1. Регистрация владельца

**Действие:** Заполнить форму регистрации
**Таблица:** `venue_owners`

**Проверка:**
```sql
SELECT id, email, full_name, phone, email_verified, created_at 
FROM venue_owners 
ORDER BY created_at DESC;
```

### 4.2. Вход владельца

**Действие:** Войти по email/паролю
**Таблица:** `owner_sessions` (создается JWT сессия)

**Проверка:**
```sql
SELECT owner_id, token, created_at, expires_at 
FROM owner_sessions 
WHERE expires_at > NOW() 
ORDER BY created_at DESC;
```

### 4.3. Подача заявки на заведение

**Действие:**
1. Войти в кабинет
2. "Добавить заведение"
3. Заполнить форму (название, город, адрес)
4. Отправить

**Таблица:** `venue_applications`

**Проверка:**
```sql
SELECT id, venue_name, city, owner_id, status, created_at 
FROM venue_applications 
ORDER BY created_at DESC;
```

**Статусы:**
- `pending` - на рассмотрении
- `approved` - одобрено (создается venues запись)
- `rejected` - отклонено

### 4.4. Управление заведением

**Действие:**
1. После одобрения заявки
2. Заведение появится в списке
3. Можно изменить видимость, настройки

**Таблица:** `venues`

**Проверка:**
```sql
SELECT v.id, v.title, v.city, vo.full_name as owner_name, v.visible, v.subscription_until
FROM venues v
LEFT JOIN venue_owners vo ON v.id IN (
  SELECT va.venue_id FROM venue_applications va WHERE va.owner_id = vo.id AND va.status = 'approved'
);
```

---

## Быстрые тестовые команды

### Подготовка тестовой среды

```bash
# 1. Установить PIN для админки
ssh root@103.88.241.78 "sudo -u postgres psql appdb -c \"UPDATE venues SET admin_pin = '1234' WHERE id = 1;\""

# 2. Проверить текущее состояние
ssh root@103.88.241.78 "sudo -u postgres psql appdb -c 'SELECT COUNT(*) as total, '\''clients'\'' as table_name FROM clients UNION ALL SELECT COUNT(*), '\''flavors'\'' FROM flavors UNION ALL SELECT COUNT(*), '\''mixes'\'' FROM mixes UNION ALL SELECT COUNT(*), '\''brands'\'' FROM brands UNION ALL SELECT COUNT(*), '\''venue_applications'\'' FROM venue_applications;'"

# 3. Добавить тестовые вкусы
ssh root@103.88.241.78 "sudo -u postgres psql appdb -c \"INSERT INTO flavors (id, venue_id, name, brand, description, color, is_available) VALUES (gen_random_uuid(), 1, 'Двойное яблоко', 'Al Fakher', 'Классический вкус кальяна', '#FF6B6B', true), (gen_random_uuid(), 1, 'Мята', 'Al Fakher', 'Освежающая мята', '#51CF66', true), (gen_random_uuid(), 1, 'Виноград', 'Fumari', 'Сладкий виноград', '#9775FA', true);\""

# 4. Добавить бренды
ssh root@103.88.241.78 "sudo -u postgres psql appdb -c \"INSERT INTO brands (name, venue_id) VALUES ('Al Fakher', 1), ('Fumari', 1), ('Darkside', 1) ON CONFLICT DO NOTHING;\""
```

### Проверка после тестов

```bash
# Посмотреть все данные
ssh root@103.88.241.78 "sudo -u postgres psql appdb -c '
SELECT '\''CLIENTS'\'' as table_name, COUNT(*)::text as count FROM clients
UNION ALL SELECT '\''FLAVORS'\'', COUNT(*)::text FROM flavors
UNION ALL SELECT '\''BRANDS'\'', COUNT(*)::text FROM brands  
UNION ALL SELECT '\''MIXES'\'', COUNT(*)::text FROM mixes
UNION ALL SELECT '\''VENUE_APPLICATIONS'\'', COUNT(*)::text FROM venue_applications
UNION ALL SELECT '\''OWNER_SESSIONS'\'', COUNT(*)::text FROM owner_sessions;
'"
```

---

## Ожидаемые результаты после полного теста

| Таблица | До теста | После теста | Примечание |
|---------|----------|-------------|------------|
| clients | 1 | 2+ | +1 за каждого авторизованного пользователя |
| flavors | 0 | 5+ | Добавленные через админку |
| brands | 0 | 3+ | Al Fakher, Fumari, Darkside |
| mixes | 1 | 5+ | Созданные пользователями миксы |
| venue_applications | 0 | 1+ | Заявки от владельцев |
| owner_sessions | 0 | 1+ | Активные сессии владельцев |
| venue_owners | 0 | 1+ | Зарегистрированные владельцы |
