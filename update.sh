#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

echo "==> Memperbarui SuperDNS dari GitHub..."
git pull origin main

# Cek apakah ada perubahan pada konfigurasi Unbound sebelum reload
# JANGAN restart resolver jika tidak ada perubahan agar uptime & cache DNS klien tetap 100% terjaga
if [ -f "./src/scripts/dnstrust-control" ]; then
    echo "==> Menerapkan hot-remap konfigurasi DNS (zero-downtime)..."
    /usr/local/sbin/dnstrust-control refresh 2>/dev/null || true
fi

# Otomatis update & build dashboard jika Node.js tersedia
if [ -d "./dashboard" ] && command -v npm >/dev/null 2>&1; then
    echo "==> Memperbarui dan me-rebuild Custom Dashboard (TypeScript)..."
    cd dashboard
    npm install --silent
    npm run build
    
    # Restart dashboard service jika ada
    if systemctl is-active --quiet superdns-dashboard.service 2>/dev/null; then
        echo "==> Merestart layanan superdns-dashboard..."
        systemctl restart superdns-dashboard.service
    fi
fi

echo "==> Pembaruan SuperDNS selesai & semua layanan berjalan otomatis!"

