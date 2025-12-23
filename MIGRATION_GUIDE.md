# Migration Guide v2: Global Flavors & Master Mixes

## 🚀 Шаги миграции на production

### 1. Подготовка

```bash
# 1.1 Создать бэкап базы данных
ssh tabakapp@hookahmix.ru
cd /home/tabakapp/apps/tabak_multiuser
pg_dump -U tabakapp appdb > backup_before_migration_v2_$(date +%Y%m%d).sql

# 1.2 Загрузить файлы на сервер
# (из локальной машины)
scp migration-v2.sql tabakapp@hookahmix.ru:/home/tabakapp/apps/tabak_multiuser/
scp seed-global-flavors.js tabakapp@hookahmix.ru:/home/tabakapp/apps/tabak_multiuser/
scp flavors.csv tabakapp@hookahmix.ru:/home/tabakapp/apps/tabak_multiuser/
```

### 2. Выполнить миграцию БД

```bash
# 2.1 Применить миграцию
sudo -u postgres psql appdb -f migration-v2.sql

# 2.2 Проверить таблицы
sudo -u postgres psql appdb -c "\dt"

# Должны появиться:
# - global_flavors
# - venue_global_flavors
# - custom_flavors (переименованная из flavors)
# - mixes (с новыми колонками)
```

### 3. Загрузить глобальные вкусы из CSV

```bash
# 3.1 Установить зависимость (если нужно)
npm install csv-parse

# 3.2 Запустить seed скрипт
node seed-global-flavors.js flavors.csv

# Ожидаемый результат:
# ✅ Parsed 1300 flavors from CSV
# ✅ 1300 valid records to insert
# 📦 Batch 1: inserted 500 / 500
# 📦 Batch 2: inserted 500 / 500
# 📦 Batch 3: inserted 300 / 300
# ✅ Seed completed successfully!
```

### 4. Очистить старые данные (опционально)

```bash
# ВНИМАНИЕ: Это удалит все старые миксы и вкусы!
# Раскомментируй в migration-v2.sql строки TRUNCATE

sudo -u postgres psql appdb <<EOF
TRUNCATE TABLE custom_flavors CASCADE;
TRUNCATE TABLE mixes CASCADE;
TRUNCATE TABLE brands CASCADE;
EOF
```

### 5. Перезапустить API сервер

```bash
# 5.1 Обновить код
cd /home/tabakapp/apps/tabak_multiuser
git pull  # или загрузить новые файлы

# 5.2 Установить зависимости
npm install

# 5.3 Перезапустить PM2
pm2 restart tabak-api
pm2 logs tabak-api --lines 50
```

### 6. Проверка

```bash
# 6.1 Проверить API endpoints
curl https://hookahmix.ru/api/global-flavors | jq 'length'
# Ожидается: 1300

# 6.2 Проверить venues
curl https://hookahmix.ru/api/venues | jq '.[0]'

# 6.3 Открыть в браузере
# https://hookahmix.ru/app
# https://hookahmix.ru/owner
```

## 📊 Структура новых таблиц

### global_flavors
```
id (UUID) | name | brand | description | color | created_at
```

### venue_global_flavors
```
venue_id | global_flavor_id | is_visible | updated_at
```
- Если записи НЕТ → вкус недоступен заведению
- Если is_visible = true → показываем в селекторе
- Если is_visible = false → не показываем, но в списке закупки

### custom_flavors (ex-flavors)
```
id | venue_id | name | brand | description | color | is_available | created_at
```
- Только для вкусов, которых нет в global_flavors

### mixes (обновленная)
```
+ is_master_mix BOOLEAN
+ created_by_owner_id UUID
+ display_order INTEGER
+ is_published BOOLEAN
user_id BIGINT (теперь nullable)
```

## 🔄 Откат миграции (если что-то пошло не так)

```bash
# 1. Восстановить бэкап
psql -U tabakapp appdb < backup_before_migration_v2_YYYYMMDD.sql

# 2. Удалить новые таблицы
sudo -u postgres psql appdb <<EOF
DROP TABLE IF EXISTS venue_global_flavors CASCADE;
DROP TABLE IF EXISTS global_flavors CASCADE;
ALTER TABLE custom_flavors RENAME TO flavors;
ALTER TABLE mixes DROP COLUMN IF EXISTS is_master_mix;
ALTER TABLE mixes DROP COLUMN IF EXISTS created_by_owner_id;
ALTER TABLE mixes DROP COLUMN IF EXISTS display_order;
ALTER TABLE mixes DROP COLUMN IF EXISTS is_published;
ALTER TABLE mixes ALTER COLUMN user_id SET NOT NULL;
EOF

# 3. Перезапустить старый код
pm2 restart tabak-api
```

## ❓ FAQ

**Q: Что делать если CSV файл большой (>10MB)?**
A: Seed скрипт обрабатывает батчами по 500 записей. Должно работать без проблем.

**Q: Можно ли загрузить CSV несколько раз?**
A: Да, скрипт использует `ON CONFLICT DO NOTHING` для дедупликации по (brand, name).

**Q: Как добавить новые вкусы в global_flavors потом?**
A: Либо через SQL:
```sql
INSERT INTO global_flavors (id, name, brand, description, color)
VALUES (gen_random_uuid(), 'New Flavor', 'Brand', 'Description', '#10b981')
ON CONFLICT (brand, name) DO NOTHING;
```
Либо запустить seed скрипт с обновленным CSV.

**Q: Что если venues уже существуют?**
A: После миграции нужно вручную создать записи в venue_global_flavors для существующих venues:
```sql
-- Дать всем venues доступ ко всем глобальным вкусам (невидимым по умолчанию)
INSERT INTO venue_global_flavors (venue_id, global_flavor_id, is_visible)
SELECT v.id, gf.id, false
FROM venues v
CROSS JOIN global_flavors gf
ON CONFLICT DO NOTHING;
```
