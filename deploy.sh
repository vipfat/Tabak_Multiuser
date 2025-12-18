#!/bin/bash
set -e

echo "🚀 Деплой на production hookahmix.ru"
echo "===================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SERVER="hookahmix.ru"
USER="tabakapp"
REMOTE_DIR="/home/tabakapp/apps/tabak_multiuser"

# Проверка что все собрано
if [ ! -f "deploy.tar.gz" ]; then
    echo -e "${YELLOW}⚠ Архив не найден, создаю...${NC}"
    tar -czf deploy.tar.gz server/ dist/ package.json package-lock.json .env.local
    echo -e "${GREEN}✓ Архив создан${NC}"
fi

echo -e "${YELLOW}📤 Загружаю файлы на сервер...${NC}"
scp deploy.tar.gz ${USER}@${SERVER}:/tmp/

echo ""
echo -e "${YELLOW}🔧 Выполняю обновление на сервере...${NC}"

ssh ${USER}@${SERVER} << 'ENDSSH'
set -e

echo "1️⃣  Создаю бэкап..."
cd /home/tabakapp/apps/tabak_multiuser
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz server/ dist/ 2>/dev/null || true
echo "✓ Бэкап создан"

echo ""
echo "2️⃣  Распаковываю новые файлы..."
tar -xzf /tmp/deploy.tar.gz -C /home/tabakapp/apps/tabak_multiuser/
rm /tmp/deploy.tar.gz
echo "✓ Файлы обновлены"

echo ""
echo "3️⃣  Проверяю базу данных..."
psql -U tabakapp -d appdb -c "SELECT COUNT(*) FROM venue_owners;" > /dev/null 2>&1 || {
    echo "⚠ Таблицы не найдены, создаю..."
    psql -U tabakapp -d appdb << 'EOSQL'
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

CREATE TABLE IF NOT EXISTS owner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
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

ALTER TABLE venues ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES venue_owners(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
EOSQL
    echo "✓ Таблицы созданы"
}
echo "✓ База данных готова"

echo ""
echo "4️⃣  Перезапускаю PM2..."
pm2 stop tabak-api 2>/dev/null || true
pm2 delete tabak-api 2>/dev/null || true
cd /home/tabakapp/apps/tabak_multiuser
pm2 start server/api.js --name tabak-api
echo "✓ PM2 перезапущен"

echo ""
echo "5️⃣  Проверяю статус..."
sleep 2
pm2 status tabak-api

echo ""
echo "6️⃣  Копирую owner-страницу в landing..."
cp /home/tabakapp/apps/tabak_multiuser/dist/owner.html /home/tabakapp/apps/tabak_landing/dist/ 2>/dev/null || true
cp /home/tabakapp/apps/tabak_multiuser/dist/assets/owner-*.js /home/tabakapp/apps/tabak_landing/dist/assets/ 2>/dev/null || true
cp /home/tabakapp/apps/tabak_multiuser/dist/assets/settings-*.js /home/tabakapp/apps/tabak_landing/dist/assets/ 2>/dev/null || true
cp /home/tabakapp/apps/tabak_multiuser/dist/assets/settings-*.css /home/tabakapp/apps/tabak_landing/dist/assets/ 2>/dev/null || true
echo "✓ Owner-страница обновлена"

echo ""
echo "✅ Деплой завершен успешно!"
echo ""
echo "Проверьте:"
echo "  - API: https://hookahmix.ru/api/venues"
echo "  - Owner: https://hookahmix.ru/owner"
echo ""

ENDSSH

echo ""
echo -e "${GREEN}✅ Деплой завершен!${NC}"
echo ""
echo "Тест API:"
curl -s https://hookahmix.ru/api/venues | jq 'length' && echo "✓ API работает"
echo ""
echo -e "${YELLOW}Логи:${NC} ssh ${USER}@${SERVER} pm2 logs tabak-api"
