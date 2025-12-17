#!/bin/bash
# Скрипт для проверки здоровья системы на сервере

echo "🏥 Проверка здоровья системы Tabak Multiuser"
echo "=============================================="
echo ""

# Цвета
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Счетчики
ERRORS=0
WARNINGS=0

check_service() {
    local name=$1
    local command=$2
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $name работает"
    else
        echo -e "${RED}✗${NC} $name НЕ РАБОТАЕТ"
        ((ERRORS++))
    fi
}

check_warning() {
    local name=$1
    local command=$2
    local expected=$3
    
    result=$(eval "$command" 2>&1)
    if [ "$result" == "$expected" ]; then
        echo -e "${GREEN}✓${NC} $name: OK"
    else
        echo -e "${YELLOW}⚠${NC} $name: $result"
        ((WARNINGS++))
    fi
}

echo "1️⃣  Проверка сервисов..."
echo "------------------------"
check_service "PostgreSQL" "systemctl is-active postgresql"
check_service "Nginx" "systemctl is-active nginx"
check_service "PM2" "pm2 ping"
echo ""

echo "2️⃣  Проверка процессов..."
echo "-------------------------"
if pm2 list | grep -q "tabak-api.*online"; then
    echo -e "${GREEN}✓${NC} API процесс запущен"
else
    echo -e "${RED}✗${NC} API процесс НЕ ЗАПУЩЕН"
    ((ERRORS++))
fi
echo ""

echo "3️⃣  Проверка портов..."
echo "----------------------"
check_service "API на порту 3000" "netstat -tulpn | grep -q ':3000.*LISTEN'"
check_service "Nginx на порту 80" "netstat -tulpn | grep -q ':80.*LISTEN'"
check_service "Nginx на порту 443" "netstat -tulpn | grep -q ':443.*LISTEN'"
echo ""

echo "4️⃣  Проверка базы данных..."
echo "---------------------------"
if psql -U tabakapp -d appdb -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Подключение к БД работает"
    
    # Проверка количества соединений
    connections=$(psql -U postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname='appdb';")
    connections=$(echo $connections | xargs)
    echo "   Активных соединений: $connections"
    
    if [ "$connections" -gt 50 ]; then
        echo -e "${YELLOW}⚠${NC} Много соединений! Возможна утечка."
        ((WARNINGS++))
    fi
    
    # Проверка таблиц
    tables=$(psql -U tabakapp -d appdb -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
    tables=$(echo $tables | xargs)
    echo "   Таблиц в БД: $tables"
    
else
    echo -e "${RED}✗${NC} НЕ МОГУ ПОДКЛЮЧИТЬСЯ К БД"
    ((ERRORS++))
fi
echo ""

echo "5️⃣  Проверка .env конфигурации..."
echo "---------------------------------"
if [ -f /home/tabakapp/apps/tabak_multiuser/.env.local ]; then
    echo -e "${GREEN}✓${NC} Файл .env.local существует"
    
    # Проверка DATABASE_URL
    if grep -q "DATABASE_URL=" /home/tabakapp/apps/tabak_multiuser/.env.local; then
        echo -e "${GREEN}✓${NC} DATABASE_URL настроен"
    else
        echo -e "${RED}✗${NC} DATABASE_URL НЕ НАЙДЕН"
        ((ERRORS++))
    fi
    
    # Проверка JWT_SECRET
    if grep -q "JWT_SECRET=" /home/tabakapp/apps/tabak_multiuser/.env.local; then
        jwt_secret=$(grep "JWT_SECRET=" /home/tabakapp/apps/tabak_multiuser/.env.local | cut -d '=' -f 2)
        if [ "$jwt_secret" == "your-secret-key-change-in-production" ]; then
            echo -e "${RED}✗${NC} JWT_SECRET использует ДЕФОЛТНОЕ ЗНАЧЕНИЕ (небезопасно!)"
            ((ERRORS++))
        else
            echo -e "${GREEN}✓${NC} JWT_SECRET настроен"
        fi
    else
        echo -e "${YELLOW}⚠${NC} JWT_SECRET не найден"
        ((WARNINGS++))
    fi
    
else
    echo -e "${RED}✗${NC} Файл .env.local НЕ НАЙДЕН"
    ((ERRORS++))
fi
echo ""

echo "6️⃣  Проверка API эндпоинтов..."
echo "------------------------------"
# Проверка /api/test
if curl -s http://localhost:3000/api/test | grep -q "ok"; then
    echo -e "${GREEN}✓${NC} /api/test работает"
else
    echo -e "${RED}✗${NC} /api/test НЕ ОТВЕЧАЕТ"
    ((ERRORS++))
fi

# Проверка /api/venues
if curl -s http://localhost:3000/api/venues > /dev/null 2>&1; then
    venues_count=$(curl -s http://localhost:3000/api/venues | grep -o "id" | wc -l)
    echo -e "${GREEN}✓${NC} /api/venues работает (заведений: $venues_count)"
else
    echo -e "${RED}✗${NC} /api/venues НЕ ОТВЕЧАЕТ"
    ((ERRORS++))
fi
echo ""

echo "7️⃣  Проверка логов на ошибки..."
echo "-------------------------------"
# Последние ошибки в PM2
error_lines=$(pm2 logs tabak-api --nostream --lines 50 | grep -i "error" | wc -l)
if [ "$error_lines" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Нет ошибок в логах PM2"
else
    echo -e "${YELLOW}⚠${NC} Найдено ошибок в PM2: $error_lines"
    ((WARNINGS++))
    echo "   Последние ошибки:"
    pm2 logs tabak-api --nostream --lines 50 | grep -i "error" | tail -3
fi
echo ""

echo "8️⃣  Использование ресурсов..."
echo "-----------------------------"
# Использование диска
disk_usage=$(df -h /home | tail -1 | awk '{print $5}' | sed 's/%//')
echo "   Использование диска: $disk_usage%"
if [ "$disk_usage" -gt 80 ]; then
    echo -e "${YELLOW}⚠${NC} Мало места на диске!"
    ((WARNINGS++))
fi

# Использование памяти
mem_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100)}')
echo "   Использование памяти: $mem_usage%"
if [ "$mem_usage" -gt 90 ]; then
    echo -e "${YELLOW}⚠${NC} Мало памяти!"
    ((WARNINGS++))
fi
echo ""

echo "=============================================="
echo "📊 ИТОГИ:"
echo "=============================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ!${NC}"
    echo "Система работает нормально."
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ Найдено предупреждений: $WARNINGS${NC}"
    echo "Система работает, но есть проблемы."
else
    echo -e "${RED}✗ Найдено критических ошибок: $ERRORS${NC}"
    echo -e "${YELLOW}⚠ Предупреждений: $WARNINGS${NC}"
    echo ""
    echo "Рекомендации:"
    echo "1. Проверьте логи: pm2 logs tabak-api"
    echo "2. Проверьте статус: pm2 list"
    echo "3. Смотрите DIAGNOSTICS.md для подробной диагностики"
fi
echo ""
