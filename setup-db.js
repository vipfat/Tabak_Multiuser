import { execSync } from 'child_process';
import fs from 'fs';

console.log('🚀 Инициализация базы данных PostgreSQL...\n');

try {
  const sqlScript = `
-- Удаляем старые объекты если они существуют
DROP DATABASE IF EXISTS appdb;
DROP USER IF EXISTS tabakapp;

-- Создание пользователя и БД
CREATE USER tabakapp WITH PASSWORD 'tabakpass123' CREATEDB;
CREATE DATABASE appdb OWNER tabakapp;

-- Подключаемся к БД и создаем таблицы
\\\\c appdb tabakapp

CREATE TABLE IF NOT EXISTS venue_owners (
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

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  city VARCHAR(255),
  address TEXT,
  logo TEXT,
  slug VARCHAR(255) UNIQUE,
  bowl_capacity INTEGER DEFAULT 18,
  allow_brand_mixing BOOLEAN DEFAULT true,
  subscription_until TIMESTAMP,
  visible BOOLEAN DEFAULT true,
  admin_pin VARCHAR(50),
  flavor_schema JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id) ON DELETE CASCADE,
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES venue_owners(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address INET,
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
CREATE INDEX IF NOT EXISTS idx_venues_owner ON venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_venues_slug ON venues(slug);
CREATE INDEX IF NOT EXISTS idx_venue_applications_owner ON venue_applications(owner_id);
CREATE INDEX IF NOT EXISTS idx_venue_applications_status ON venue_applications(status);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_owner ON owner_sessions(owner_id);
CREATE INDEX IF NOT EXISTS idx_owner_sessions_expires ON owner_sessions(expires_at);

GRANT CONNECT ON DATABASE appdb TO tabakapp;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO tabakapp;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO tabakapp;

-- Вставляем демо-площадку
INSERT INTO venues (id, title, city, visible)
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Venue', 'Moscow', true)
ON CONFLICT DO NOTHING;
`;

  fs.writeFileSync('/tmp/setup_db.sql', sqlScript);
  
  console.log('📝 Выполняем SQL скрипт...');
  execSync('psql -U postgres -h /var/run/postgresql -f /tmp/setup_db.sql 2>&1 | tail -20', {
    stdio: 'inherit'
  });

  console.log('\n✅ База данных полностью настроена!\n');
  console.log('📍 Параметры подключения:');
  console.log('   Host: localhost');
  console.log('   Port: 5432');
  console.log('   Database: appdb');
  console.log('   User: tabakapp');
  console.log('   Password: tabakpass123');
  console.log('\n📝 DATABASE_URL для .env.local:');
  console.log('   postgresql://tabakapp:tabakpass123@localhost:5432/appdb');
  console.log('\n✨ Следующий шаг: создайте файл .env.local с этим DATABASE_URL\n');

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error('\n💡 Убедитесь что:');
  console.error('   1. PostgreSQL запущен: pg_isready');
  console.error('   2. Вы находитесь на Ubuntu/Linux');
  process.exit(1);
}
