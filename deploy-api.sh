#!/bin/bash
# Деплой обновленного API на продакшен

echo "🚀 Деплой API на hookahmix.ru..."

# Копируем обновленный api.js на сервер
echo "📦 Копирую server/api.js..."
scp server/api.js tabakapp@hookahmix.ru:/home/tabakapp/api/server/

# Перезапускаем API сервис
echo "🔄 Перезапуск API сервиса..."
ssh tabakapp@hookahmix.ru "pm2 restart tabak-api || systemctl --user restart tabak-api || (cd /home/tabakapp/api && pm2 restart api.js)"

echo "✅ Деплой завершен!"
