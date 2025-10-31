#!/bin/sh
set -e

# Fix permissions for mounted volumes
# This ensures the nodejs user can write to the database directory
if [ -d /app/data ]; then
    chown -R nodejs:nodejs /app/data
fi

if [ -d /app/uploads ]; then
    chown -R nodejs:nodejs /app/uploads
fi

# Execute the main command as nodejs user
exec su-exec nodejs "$@"
