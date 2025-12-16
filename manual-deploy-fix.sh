#!/bin/bash
# Ручное исправление - запустите это на своей машине

set -e

SERVER="root@103.88.241.78"
APP_DIR="/home/tabakapp/apps/tabak_multiuser"

echo "=== Uploading fixed files ==="
scp server/api.js $SERVER:$APP_DIR/server/api.js
scp server/ownerRoutes.js $SERVER:$APP_DIR/server/ownerRoutes.js

echo ""
echo "=== Verifying upload ==="
ssh $SERVER "grep -c 'name as title' $APP_DIR/server/api.js"

echo ""
echo "=== Restarting PM2 completely ==="
ssh $SERVER << 'EOF'
cd /home/tabakapp/apps/tabak_multiuser
pm2 delete tabak-api || pm2 kill
sleep 2
pm2 start server/api.js --name tabak-api --cwd $(pwd)
pm2 save
sleep 3
pm2 list
EOF

echo ""
echo "=== Testing API ==="
sleep 2
curl -s https://hookahmix.ru/api/venues | jq . || curl -s https://hookahmix.ru/api/venues

echo ""
echo "=== Testing /owner ==="
curl -sI https://hookahmix.ru/owner | grep Content-Type

echo ""
echo "✅ Done! Check https://hookahmix.ru/owner"
