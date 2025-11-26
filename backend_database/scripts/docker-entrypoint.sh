#!/bin/sh
set -e

if [ -d /app/data ]; then
    chown -R nodejs:nodejs /app/data 2>/dev/null || true
    chmod -R 777 /app/data 2>/dev/null || true
    find /app/data -type f -exec chmod 666 {} + 2>/dev/null || true
    find /app/data -type d -exec chmod 777 {} + 2>/dev/null || true
fi

if [ -d /app/uploads ]; then
    chown -R nodejs:nodejs /app/uploads 2>/dev/null || true
    chmod -R 777 /app/uploads 2>/dev/null || true
    find /app/uploads -type f -exec chmod 666 {} + 2>/dev/null || true
    find /app/uploads -type d -exec chmod 777 {} + 2>/dev/null || true
fi

exec su-exec nodejs "$@"
