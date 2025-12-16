#!/bin/bash

# Исправляем пути в owner.html с /app/assets на /assets
# потому что owner.html находится в корне, не в /app

if [ -f "dist/owner.html" ]; then
    echo "Исправляю пути в owner.html..."
    sed -i 's|/app/assets|/assets|g' dist/owner.html
    echo "✓ Пути исправлены"
else
    echo "⚠️ dist/owner.html не найден"
fi
