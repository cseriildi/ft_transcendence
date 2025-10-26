#!/bin/sh
set -e

# Create data directory if it doesn't exist and set permissions
mkdir -p /app/data
chown -R node:node /app/data
chmod -R 755 /app/data

# Switch to node user and execute the main command
exec su-exec node "$@"
