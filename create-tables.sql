-- Create missing tables for Tabak Multiuser application
-- Run on server: sudo -u postgres psql appdb -f create-tables.sql

-- Clients table (for Telegram users)
CREATE TABLE IF NOT EXISTS clients (
  id BIGINT PRIMARY KEY,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  username VARCHAR(255),
  language_code VARCHAR(10),
  last_seen_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_username ON clients(username);
CREATE INDEX IF NOT EXISTS idx_clients_last_seen ON clients(last_seen_at);

-- Brands table (hookah tobacco brands per venue)
CREATE TABLE IF NOT EXISTS brands (
  name VARCHAR(255) NOT NULL,
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  PRIMARY KEY (name, venue_id)
);

CREATE INDEX IF NOT EXISTS idx_brands_venue ON brands(venue_id);

-- Flavors table (tobacco flavors per venue)
CREATE TABLE IF NOT EXISTS flavors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id INTEGER NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  description TEXT,
  color VARCHAR(50),
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flavors_venue ON flavors(venue_id);
CREATE INDEX IF NOT EXISTS idx_flavors_brand ON flavors(brand);
CREATE INDEX IF NOT EXISTS idx_flavors_available ON flavors(is_available);

-- Mixes table (saved user mixes)
CREATE TABLE IF NOT EXISTS mixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255),
  ingredients JSONB,
  is_favorite BOOLEAN DEFAULT false,
  venue_snapshot JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mixes_user ON mixes(user_id);
CREATE INDEX IF NOT EXISTS idx_mixes_favorite ON mixes(is_favorite);
CREATE INDEX IF NOT EXISTS idx_mixes_created ON mixes(created_at);

-- Display results
SELECT 'Tables created successfully!' as status;
SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
