-- SQL скрипт для добавления тестовых заведений
-- Выполните на продакшен сервере: psql -d appdb -f seed-venues.sql
-- Схема: venues(id integer, name varchar, city varchar, visible boolean)

-- Добавляем тестовые заведения
INSERT INTO venues (name, city, visible, bowl_capacity, allow_brand_mixing)
VALUES 
  ('Тестовая Лаунж', 'Москва', true, 18, true),
  ('Песочница Миксов', 'Санкт-Петербург', true, 20, true)
RETURNING id, name, city;

-- Примечание: На проде нет таблиц brands и flavors
-- Они управляются через flavor_schema JSONB в таблице venues
-- Для добавления вкусов используйте Admin Panel или API /api/flavors

-- Проверяем результат
SELECT 'Venues added:' as info;
SELECT id, name as title, city, visible FROM venues ORDER BY name;
