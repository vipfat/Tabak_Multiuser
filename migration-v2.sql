-- Migration v2: Global Flavors, Master Mixes, Statistics
-- Run: sudo -u postgres psql appdb -f migration-v2.sql

-- ========================================
-- 1. ГЛОБАЛЬНАЯ БАЗА ВКУСОВ (~1300 flavors)
-- ========================================

CREATE TABLE IF NOT EXISTS global_flavors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50) NOT NULL DEFAULT '#10b981',
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Уникальность по комбинации (бренд + название)
  CONSTRAINT unique_brand_name UNIQUE(brand, name)
);

CREATE INDEX IF NOT EXISTS idx_global_flavors_brand ON global_flavors(brand);
CREATE INDEX IF NOT EXISTS idx_global_flavors_name ON global_flavors(name);

-- ========================================
-- 2. ВИДИМОСТЬ глобальных вкусов для venues
-- ========================================

CREATE TABLE IF NOT EXISTS venue_global_flavors (
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  global_flavor_id UUID NOT NULL REFERENCES global_flavors(id) ON DELETE CASCADE,
  is_visible BOOLEAN DEFAULT true,  -- видимость в селекторе (для списка закупки)
  updated_at TIMESTAMP DEFAULT NOW(),
  
  PRIMARY KEY (venue_id, global_flavor_id)
);

CREATE INDEX IF NOT EXISTS idx_venue_global_flavors_venue ON venue_global_flavors(venue_id);
CREATE INDEX IF NOT EXISTS idx_venue_global_flavors_visible ON venue_global_flavors(venue_id, is_visible);

-- ========================================
-- 3. КАСТОМНЫЕ ВКУСЫ (переименовываем старую таблицу)
-- ========================================

-- Переименовываем flavors в custom_flavors
ALTER TABLE IF EXISTS flavors RENAME TO custom_flavors;

-- Убеждаемся что структура правильная
ALTER TABLE custom_flavors 
  ALTER COLUMN is_available SET DEFAULT true;

-- Обновляем индексы
DROP INDEX IF EXISTS idx_flavors_venue;
DROP INDEX IF EXISTS idx_flavors_brand;
DROP INDEX IF EXISTS idx_flavors_available;

CREATE INDEX IF NOT EXISTS idx_custom_flavors_venue ON custom_flavors(venue_id);
CREATE INDEX IF NOT EXISTS idx_custom_flavors_brand ON custom_flavors(brand);
CREATE INDEX IF NOT EXISTS idx_custom_flavors_available ON custom_flavors(is_available);

-- ========================================
-- 4. ОБНОВЛЕНИЕ ТАБЛИЦЫ МИКСОВ (для мастер-миксов)
-- ========================================

-- Делаем user_id nullable (для мастер-миксов)
ALTER TABLE mixes 
  ALTER COLUMN user_id DROP NOT NULL;

-- Добавляем новые колонки
ALTER TABLE mixes 
  ADD COLUMN IF NOT EXISTS is_master_mix BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by_owner_id UUID REFERENCES venue_owners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;

-- Новые индексы для быстрого поиска мастер-миксов
CREATE INDEX IF NOT EXISTS idx_mixes_master ON mixes(is_master_mix, is_published) 
  WHERE is_master_mix = true;

CREATE INDEX IF NOT EXISTS idx_mixes_venue_master ON mixes((venue_snapshot->>'id'), is_master_mix, is_published)
  WHERE is_master_mix = true;

-- Индекс для статистики (популярные вкусы за период)
CREATE INDEX IF NOT EXISTS idx_mixes_created_venue ON mixes(created_at, (venue_snapshot->>'id'))
  WHERE is_master_mix = false;

-- ========================================
-- 5. ОЧИСТКА СТАРЫХ ДАННЫХ (fresh start)
-- ========================================

-- ВНИМАНИЕ: Это удалит все существующие данные!
-- Раскомментируй если уверен:

-- TRUNCATE TABLE custom_flavors CASCADE;
-- TRUNCATE TABLE mixes CASCADE;
-- TRUNCATE TABLE brands CASCADE;

-- ========================================
-- 6. ПРОВЕРКА РЕЗУЛЬТАТОВ
-- ========================================

SELECT 'Migration v2 completed successfully!' as status;

SELECT 
  'global_flavors' as table_name, 
  COUNT(*) as row_count 
FROM global_flavors
UNION ALL
SELECT 
  'venue_global_flavors', 
  COUNT(*) 
FROM venue_global_flavors
UNION ALL
SELECT 
  'custom_flavors', 
  COUNT(*) 
FROM custom_flavors
UNION ALL
SELECT 
  'mixes (master)', 
  COUNT(*) 
FROM mixes WHERE is_master_mix = true
UNION ALL
SELECT 
  'mixes (user)', 
  COUNT(*) 
FROM mixes WHERE is_master_mix = false;
