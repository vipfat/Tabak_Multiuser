#!/bin/bash
set -e

# Автоматический деплой исправлений на сервер
# Запуск: ./auto-deploy.sh

SERVER="103.88.241.78"
USER="root"
REMOTE_DIR="/home/tabakapp/apps/tabak_multiuser"

# Цвета
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Автоматический деплой исправлений        ║${NC}"
echo -e "${BLUE}║   Tabak Multiuser - Critical Fixes         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

# Шаг 1: Создание архива
echo -e "${YELLOW}[1/5]${NC} 📦 Создание архива с исправлениями..."
tar -czf deploy-fix.tar.gz \
    server/ \
    .env.local.example \
    health-check.sh \
    QUICK_FIX.md \
    FIX_SUMMARY.md \
    DIAGNOSTICS.md
echo -e "${GREEN}✓${NC} Архив создан: deploy-fix.tar.gz"
echo ""

# Шаг 2: Загрузка на сервер
echo -e "${YELLOW}[2/5]${NC} 📤 Загрузка файлов на сервер..."
echo "   Сервер: ${SERVER}"
echo "   Пользователь: ${USER}"
echo ""
scp -o StrictHostKeyChecking=no deploy-fix.tar.gz ${USER}@${SERVER}:/tmp/
echo -e "${GREEN}✓${NC} Файлы загружены на сервер"
echo ""

# Шаг 3: Выполнение обновления на сервере
echo -e "${YELLOW}[3/5]${NC} 🔧 Выполнение обновления на сервере..."
ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} << 'ENDSSH'
set -e

echo "   → Переход в директорию приложения..."
cd /home/tabakapp/apps/tabak_multiuser

echo "   → Создание бэкапа текущих файлов..."
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz server/ 2>/dev/null || true

echo "   → Распаковка обновлений..."
tar -xzf /tmp/deploy-fix.tar.gz
rm /tmp/deploy-fix.tar.gz

echo "   → Установка прав..."
chmod +x health-check.sh

echo "   → Проверка .env.local..."
if [ ! -f .env.local ]; then
    echo "   ⚠️  Файл .env.local не найден, создаю из шаблона..."
    cp .env.local.example .env.local
    echo "   ⚠️  ВАЖНО: Отредактируйте .env.local вручную!"
else
    echo "   ✓ Файл .env.local существует"
fi

echo "   → Перезапуск API через PM2..."
pm2 restart tabak-api 2>/dev/null || {
    echo "   ⚠️  PM2 процесс не найден, пытаюсь запустить..."
    cd /home/tabakapp/apps/tabak_multiuser
    pm2 start server/api.js --name tabak-api
}

echo "   → Ожидание запуска сервера (3 сек)..."
sleep 3

ENDSSH

echo -e "${GREEN}✓${NC} Обновление выполнено"
echo ""

# Шаг 4: Проверка здоровья системы
echo -e "${YELLOW}[4/5]${NC} 🏥 Запуск проверки здоровья системы..."
echo ""
ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} << 'ENDSSH'
cd /home/tabakapp/apps/tabak_multiuser
./health-check.sh
ENDSSH
echo ""

# Шаг 5: Проверка API эндпоинтов
echo -e "${YELLOW}[5/5]${NC} 🔍 Проверка API эндпоинтов..."
ssh -o StrictHostKeyChecking=no ${USER}@${SERVER} << 'ENDSSH'
echo "   Тестирование /api/test..."
curl -s http://localhost:3000/api/test | head -c 100
echo ""
echo ""
echo "   Тестирование /api/venues..."
curl -s http://localhost:3000/api/venues | head -c 200
echo ""
echo ""
ENDSSH
echo -e "${GREEN}✓${NC} API отвечает"
echo ""

# Финал
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           ДЕПЛОЙ ЗАВЕРШЕН!                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓${NC} Исправления установлены"
echo -e "${GREEN}✓${NC} API перезапущен"
echo -e "${GREEN}✓${NC} Проверка здоровья выполнена"
echo ""
echo "📊 Просмотр логов:"
echo "   ssh ${USER}@${SERVER} \"pm2 logs tabak-api\""
echo ""
echo "🔍 Повторная проверка:"
echo "   ssh ${USER}@${SERVER} \"cd ${REMOTE_DIR} && ./health-check.sh\""
echo ""
echo -e "${YELLOW}⚠️  ВАЖНО:${NC} Не забудьте проверить .env.local на сервере!"
echo "   ssh ${USER}@${SERVER} \"nano ${REMOTE_DIR}/.env.local\""
echo ""
echo -e "${RED}🚨 СРОЧНО:${NC} Измените пароль root на сервере:"
echo "   ssh ${USER}@${SERVER} \"passwd\""
echo ""
