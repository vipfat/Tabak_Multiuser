#!/bin/bash

# Deploy owner page to production
# Usage: ./deploy-owner.sh

set -e

SERVER="root@103.88.241.78"
LANDING_DIR="/home/tabakapp/apps/tabak_landing/dist"

echo "🔨 Building project..."
npm run build

echo "📤 Deploying owner page to $SERVER..."

# Copy owner.html
echo "  → owner.html"
scp dist/owner.html $SERVER:$LANDING_DIR/

# Copy owner JavaScript bundle
echo "  → owner-*.js"
scp dist/assets/owner-*.js $SERVER:$LANDING_DIR/assets/ 2>/dev/null || true

# Copy settings JavaScript bundle
echo "  → settings-*.js"
scp dist/assets/settings-*.js $SERVER:$LANDING_DIR/assets/ 2>/dev/null || true

# Copy settings CSS
echo "  → settings-*.css"
scp dist/assets/settings-*.css $SERVER:$LANDING_DIR/assets/ 2>/dev/null || true

echo ""
echo "✅ Owner page deployed successfully!"
echo "🌐 Visit: https://hookahmix.ru/owner"
