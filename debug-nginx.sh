#!/bin/bash
export SSHPASS='usA,NUxVtkHyB1'

echo "Finding nginx configs..."
sshpass -e ssh -o StrictHostKeyChecking=no root@103.88.241.78 << 'EOF'
find /etc/nginx -name "*.conf" -type f 2>/dev/null | grep -v "mime.types"
echo "---"
nginx -T 2>&1 | grep -A5 "location.*owner" | head -n 20
echo "---"
echo "Fixing types:"
cat > /tmp/nginx_owner_fix.conf << 'ENDCONF'
location = /owner {
    alias /home/tabakapp/apps/tabak_multiuser/dist/owner.html;
    types { text/html html; }
    default_type text/html;
}
ENDCONF

# Find where hookahmix is configured
nginx -T 2>&1 | grep -B5 "hookahmix" | head -n 10
EOF
