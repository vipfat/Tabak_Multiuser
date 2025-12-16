#!/bin/bash
# Final fix for owner.html MIME type

ssh root@103.88.241.78 << 'ENDSSH'
set -e

echo "=== Finding nginx config with /owner ==="
CONFIG=$(nginx -T 2>&1 | awk '/# configuration file.*\/etc\/nginx/ {file=$NF} /location = \/owner/ && file {gsub(/:$/,"",file); print file; exit}')

if [ -z "$CONFIG" ]; then
    echo "Config not found via nginx -T, trying common locations..."
    for f in /etc/nginx/sites-enabled/* /etc/nginx/conf.d/* /etc/nginx/nginx.conf; do
        if [ -f "$f" ] && grep -q "location.*owner" "$f" 2>/dev/null; then
            CONFIG="$f"
            break
        fi
    done
fi

echo "Config file: $CONFIG"

if [ -z "$CONFIG" ] || [ ! -f "$CONFIG" ]; then
    echo "ERROR: Could not find config file"
    exit 1
fi

# Backup
cp "$CONFIG" "$CONFIG.bak-$(date +%s)"

# Use perl for reliable multi-line replacement
perl -i -pe 'BEGIN{undef $/;} s/location\s*=\s*\/owner\s*\{[^}]*\}/location = \/owner {\n        alias \/home\/tabakapp\/apps\/tabak_multiuser\/dist\/owner.html;\n        add_header Content-Type "text\/html; charset=utf-8" always;\n    }/sg' "$CONFIG"

echo "=== New config ==="
grep -A5 "location = /owner" "$CONFIG"

echo ""
echo "=== Testing and reloading ==="
nginx -t && systemctl reload nginx

echo "✅ Done!"
ENDSSH

echo ""
echo "=== Verification ==="
sleep 2
curl -sI https://hookahmix.ru/owner | grep -E "HTTP|Content-Type"
echo ""
curl -s https://hookahmix.ru/owner | head -c 200
