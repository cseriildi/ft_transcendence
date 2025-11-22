#!/bin/sh
set -e

mkdir -p /app/data

chown -R nodejs:nodejs /app/data 2>/dev/null || true
chmod -R 775 /app/data 2>/dev/null || true
find /app/data -type f -exec chmod 664 {} + 2>/dev/null || true
find /app/data -type d -exec chmod 775 {} + 2>/dev/null || true

exec su-exec nodejs "$@"
