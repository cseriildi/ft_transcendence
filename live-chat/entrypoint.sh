#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Fix permissions on the data directory and contents
chown -R nodejs:nodejs /app/data
chmod -R 775 /app/data

# If database file doesn't exist, create it with correct permissions
if [ ! -f /app/data/database.db ]; then
    touch /app/data/database.db
    chown nodejs:nodejs /app/data/database.db
    chmod 664 /app/data/database.db
fi

exec su-exec nodejs "$@"
