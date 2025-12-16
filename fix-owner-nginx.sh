#!/bin/bash
# Fix nginx to serve owner.html correctly

export SSHPASS='usA,NUxVtkHyB1'

sshpass -e ssh -o StrictHostKeyChecking=no root@103.88.241.78 'bash -s' << 'ENDSSH'
set -e

# Backup
cp /etc/nginx/sites-enabled/hookahmix.ru /etc/nginx/sites-enabled/hookahmix.ru.bak

# Create corrected config with proper owner handling
cat > /etc/nginx/sites-enabled/hookahmix.ru << 'ENDNGINX'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name hookahmix.ru www.hookahmix.ru;

    ssl_certificate /etc/letsencrypt/live/hookahmix.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hookahmix.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Owner cabinet
    location = /owner {
        alias /home/tabakapp/apps/tabak_multiuser/dist/owner.html;
        types { text/html html; }
        default_type text/html;
    }

    # Assets for all apps
    location /assets/ {
        alias /home/tabakapp/apps/tabak_multiuser/dist/assets/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Main app
    location /app/ {
        alias /home/tabakapp/apps/tabak_multiuser/dist/;
        try_files $uri $uri/ /app/index.html;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Landing page
    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name hookahmix.ru www.hookahmix.ru;
    return 301 https://$server_name$request_uri;
}
ENDNGINX

# Test and reload
nginx -t && systemctl reload nginx

echo "✅ Nginx reloaded with owner fix"
ENDSSH

echo ""
echo "Testing owner page..."
sleep 2
curl -sI https://hookahmix.ru/owner | grep -E "HTTP|Content-Type"
