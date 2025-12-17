# Восстановление версии v1.0.0

Эта версия - стабильная рабочая версия со всеми основными функциями.

## Дата снимка
17 декабря 2025, 15:56 UTC

## Что включено

### ✅ Реализованные функции
- Админ-панель с настройками venue (bowl_capacity, allow_brand_mixing)
- Селектор вкусов с ограничениями по брендам
- Контроль миксов с динамическим размером чаши
- Интеграция Telegram-аутентификации
- Система управления клиентами
- Управление venues с облачной синхронизацией
- Полная схема БД (venues, clients, brands, flavors, mixes)

### ✅ Исправленные баги
- GET /api/venues возвращает bowl_capacity и allow_brand_mixing
- AdminPanel useEffect не сбрасывает настройки после сохранения
- BowlChart использует размер чаши конкретного venue
- Настроен connection pool
- Удалены дублирующиеся endpoints

## Восстановление из GitHub

```bash
# 1. Клонировать репозиторий
git clone https://github.com/vipfat/Tabak_Multiuser.git
cd Tabak_Multiuser

# 2. Переключиться на тег v1.0.0
git checkout tags/v1.0.0

# 3. Установить зависимости
npm install

# 4. Собрать проект
npm run build

# 5. Загрузить на сервер
rsync -avz --delete dist/ root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/dist/
rsync -avz server/ root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/

# 6. Перезапустить PM2
ssh root@103.88.241.78 "pm2 restart tabak-api"
```

## Восстановление базы данных

```bash
# На сервере восстановить бэкап
ssh root@103.88.241.78

# Восстановить БД из снимка
PGPASSWORD='aFt8055829' psql -U tabakapp -h localhost appdb < /root/backup_appdb_v1.0.0_20251217_155513.sql
```

## Восстановление из архива сервера

```bash
# На сервере
ssh root@103.88.241.78
cd /home/tabakapp/apps

# Распаковать архив
tar -xzf tabak_multiuser_v1.0.0_20251217_155617.tar.gz

# Установить зависимости
cd tabak_multiuser
npm install

# Перезапустить
pm2 restart tabak-api
```

## Расположение бэкапов

### На сервере (103.88.241.78):
- **База данных**: `/root/backup_appdb_v1.0.0_20251217_155513.sql` (27KB)
- **Архив приложения**: `/home/tabakapp/apps/tabak_multiuser_v1.0.0_20251217_155617.tar.gz` (1.4MB)

### В GitHub:
- **Коммит**: 7109088
- **Тег**: v1.0.0
- **URL**: https://github.com/vipfat/Tabak_Multiuser/releases/tag/v1.0.0

## Конфигурация на момент снимка

### Сервер
- IP: 103.88.241.78
- OS: Ubuntu 22.04.5 LTS
- Node.js: v22+ (ESM mode)
- PM2: Процесс `tabak-api`

### База данных
- PostgreSQL: appdb
- Пользователь: tabakapp
- Пароль: aFt8055829

### Telegram Bot
- Username: @kalyan_alchemic_bot
- ID: 8557683412

### Тестовые данные
- Venue 1: "Тестовая Лаунж" (PIN: 1234, bowl_capacity: 22, allow_brand_mixing: true)
- Venue 2: "Песочница Миксов" (PIN: 5678, bowl_capacity: 20, allow_brand_mixing: true)
- 7 вкусов, 5 брендов

## Проверка работоспособности

```bash
# Проверка API
curl https://hookahmix.ru/api/venues

# Проверка настроек venue
curl https://hookahmix.ru/api/venues | grep -o '"bowl_capacity":[0-9]*'

# Проверка PM2
ssh root@103.88.241.78 "pm2 status"

# Проверка базы
ssh root@103.88.241.78 "PGPASSWORD='aFt8055829' psql -U tabakapp -h localhost appdb -c 'SELECT COUNT(*) FROM venues;'"
```

## Известные ограничения
- Telegram domain не настроен в BotFather (требуется `/setdomain` → `hookahmix.ru`)
- Root пароль был компрометирован (рекомендуется сменить)

## Контакты
- GitHub: https://github.com/vipfat/Tabak_Multiuser
- Сайт: https://hookahmix.ru
