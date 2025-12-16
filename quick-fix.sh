#!/bin/bash
set -e

export SSHPASS='usA,NUxVtkHyB1'

echo "1. Uploading fixed server files..."
sshpass -e scp -o StrictHostKeyChecking=no server/api.js root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/api.js
sshpass -e scp -o StrictHostKeyChecking=no server/ownerRoutes.js root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/ownerRoutes.js

echo "2. Restarting services..."
sshpass -e ssh -o StrictHostKeyChecking=no root@103.88.241.78 'pm2 restart tabak-api && sleep 2'

echo "3. Testing API..."
curl -s https://hookahmix.ru/api/venues

echo ""
echo "4. Testing owner page HTML..."
curl -s https://hookahmix.ru/owner

echo ""
echo "Done!"
