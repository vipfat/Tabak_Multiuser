#!/bin/bash

# Переменные
PGUSER="postgres"
DBNAME="appdb"
DBUSER="tabakapp"
DBPASS="tabakpass123"

echo "🚀 Начинаем настройку базы данных PostgreSQL..."
echo ""

# Проверяем PostgreSQL
if ! command -v psql &> /dev/null; then
  echo "❌ PostgreSQL не установлен"
  exit 1
fi

echo "✓ PostgreSQL найден"

# Подключаемся к postgres и создаём пользователя и БД
echo "⏳ Создаю пользователя и базу данных..."

# Попытаемся подключиться с peer authentication (локальный сокет)
if sudo -u postgres psql -c "SELECT 1" > /dev/null 2>&1; then
  echo "  ✓ Используем local peer authentication"
  
  # Удаляем старые версии если есть
  sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DBNAME;" 2>/dev/null
  sudo -u postgres psql -c "DROP USER IF EXISTS $DBUSER;" 2>/dev/null
  
  # Создаём пользователя
  sudo -u postgres psql -c "CREATE USER $DBUSER WITH PASSWORD '$DBPASS' CREATEDB;" 2>/dev/null || {
    echo "  ℹ️  Пользователь $DBUSER уже существует, переходим дальше"
  }
  
  # Создаём БД
  sudo -u postgres psql -c "CREATE DATABASE $DBNAME OWNER $DBUSER;" 2>/dev/null || {
    echo "  ℹ️  БД $DBNAME уже существует"
  }
  
  echo "✓ Пользователь и БД готовы"
  
  # Создаём таблицы как tabakapp
  export PGPASSWORD="$DBPASS"
  
  echo "⏳ Создаю таблицы..."
  
  psql -h localhost -U $DBUSER -d $DBNAME << 'SQL'
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  logo TEXT,
  subscription_until TIMESTAMP,
  visible BOOLEAN DEFAULT true,
  admin_pin VARCHAR(50),
  flavor_schema JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flavors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  description TEXT,
  color VARCHAR(7),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(venue_id, name)
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255),
  language_code VARCHAR(10),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  ingredients JSONB DEFAULT '[]',
  is_favorite BOOLEAN DEFAULT false,
  venue_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flavors_venue ON flavors(venue_id);
CREATE INDEX IF NOT EXISTS idx_brands_venue ON brands(venue_id);
CREATE INDEX IF NOT EXISTS idx_mixes_user ON mixes(user_id);
CREATE INDEX IF NOT EXISTS idx_mixes_created ON mixes(created_at DESC);

INSERT INTO venues (id, title, city, visible)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Venue', 'Moscow', true)
ON CONFLICT DO NOTHING;
SQL

  if [ $? -eq 0 ]; then
    echo "✓ Все таблицы созданы"
  else
    echo "❌ Ошибка при создании таблиц"
    exit 1
  fi
  
else
  echo "❌ Не удалось подключиться к PostgreSQL как $PGUSER"
  exit 1
fi

unset PGPASSWORD

echo ""
echo "✅ База данных полностью настроена!"
echo ""
echo "📝 Параметры подключения:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  Database: $DBNAME"
echo "  User: $DBUSER"
echo "  Password: $DBPASS"
echo ""
echo "🔗 DATABASE_URL для .env.local:"
echo "  postgresql://$DBUSER:$DBPASS@localhost:5432/$DBNAME"
echo ""
