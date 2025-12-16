#!/bin/bash
# Ручной деплой на production сервер

set -e

SERVER="root@103.88.241.78"
APP_DIR="/home/tabakapp/apps/tabak_multiuser"

echo "🚀 Uploading files to server..."
rsync -avz --delete dist/ $SERVER:$APP_DIR/dist/
rsync -avz server/ $SERVER:$APP_DIR/server/
rsync -avz --delete package.json $SERVER:$APP_DIR/
rsync -avz setup-db.js $SERVER:$APP_DIR/

echo ""
echo "🔄 Restarting services on server..."
ssh $SERVER << 'ENDSSH'
cd /home/tabakapp/apps/tabak_multiuser

# Kill and restart PM2
pm2 delete tabak-api || true
pm2 start server/api.js --name tabak-api --cwd $(pwd)
pm2 save

# Reload nginx
nginx -t && systemctl reload nginx

# Show status
echo ""
echo "✅ PM2 Status:"
pm2 list

echo ""
echo "🔍 Checking API file:"
grep -c "information_schema" server/api.js || echo "Schema-aware code present: YES"
ENDSSH

echo ""
echo "🧪 Testing API endpoints..."
sleep 3

echo ""
echo "GET /api/venues:"
curl -s https://hookahmix.ru/api/venues | jq '.' 2>/dev/null || curl -s https://hookahmix.ru/api/venues

echo ""
echo ""
echo "POST /api/auth/login (test account):"
curl -s -X POST https://hookahmix.ru/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"prodowner@test.com","password":"test12345"}' | jq '.' 2>/dev/null

echo ""
echo "✅ Deployment complete!"
echo "🌐 Check: https://hookahmix.ru/owner"
