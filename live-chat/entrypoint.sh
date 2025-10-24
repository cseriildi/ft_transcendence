#!/bin/sh

# Ensure data directory exists and has correct permissions
# Run this as root before switching to nodejs user
if [ "$(id -u)" = "0" ]; then
  # Running as root, fix permissions
  mkdir -p /app/data
  chown -R nodejs:nodejs /app/data
  chmod -R 755 /app/data
  
  # Switch to nodejs user and execute the command
  exec su-exec nodejs "$@"
else
  # Already running as nodejs user
  mkdir -p /app/data 2>/dev/null || true
  exec "$@"
fi
