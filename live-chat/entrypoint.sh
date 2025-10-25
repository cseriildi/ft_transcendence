#!/bin/sh
set -e

# Create data directory if it doesn't exist and set permissions
mkdir -p /app/data
chown -R nodejs:nodejs /app/data
chmod -R 755 /app/data

# Switch to nodejs user and execute the main command
exec su-exec nodejs "$@"
