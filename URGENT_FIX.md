# СРОЧНОЕ ИСПРАВЛЕНИЕ - выполните на своей машине

## Проблема
На сервере запущен старый код API, который ищет колонку `title` вместо `name`.

## Решение

### Вариант 1: Полный рестарт (РЕКОМЕНДУЕТСЯ)

```bash
ssh root@103.88.241.78

# Найти и убить ВСЕ процессы Node
pkill -9 node
pm2 kill

# Загрузить свежий код
cd /home/tabakapp/apps/tabak_multiuser
git pull origin main  # если есть git
# ИЛИ вручную скопировать файлы с локальной машины:
# exit
# scp server/api.js root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/
# scp server/ownerRoutes.js root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/
# ssh root@103.88.241.78

# Запустить заново
cd /home/tabakapp/apps/tabak_multiuser
pm2 start server/api.js --name tabak-api
pm2 save

# Проверить
sleep 2
curl http://localhost:3000/api/venues
# Должен вернуть список заведений БЕЗ ошибки
```

### Вариант 2: Если на сервере нет нужных колонок в БД

Подключитесь к БД и добавьте недостающие колонки:

```bash
ssh root@103.88.241.78
psql $DATABASE_URL

-- Проверить структуру
\d venues

-- Если нет колонки logo:
ALTER TABLE venues ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS subscription_until TIMESTAMP;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS visible BOOLEAN DEFAULT true;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS flavor_schema JSONB;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS bowl_capacity INTEGER DEFAULT 18;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS allow_brand_mixing BOOLEAN DEFAULT true;

\q
```

### Вариант 3: Минимальный запрос (если БД очень старая)

Если в БД только `id`, `name`, `city` - я уже подготовил упрощённый код.
Выполните:

```bash
cd /path/to/Tabak_Multiuser
scp server/api.js root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/
ssh root@103.88.241.78 'pm2 restart tabak-api'
```

## Проверка

После любого варианта проверьте:

```bash
curl https://hookahmix.ru/api/venues
# Должен вернуть JSON с заведениями

curl https://hookahmix.ru/owner
# Должна открыться HTML страница

# В браузере:
# https://hookahmix.ru/owner - должна работать форма входа
```

## Если ничего не помогает

Посмотрите логи PM2:
```bash
ssh root@103.88.241.78 'pm2 logs tabak-api --lines 50'
```

И отправьте мне вывод.
