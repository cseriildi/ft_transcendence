#!/bin/sh
set -e

# Fix permissions for mounted volumes
# This ensures the nodejs user can write to the database directory
# Note: chown may fail on some systems (e.g., mounted volumes with different owners)
# In that case, we'll run as root instead of nodejs user
CAN_CHOWN=true

if [ -d /app/data ]; then
    chown -R nodejs:nodejs /app/data 2>/dev/null || CAN_CHOWN=false
fi

if [ -d /app/uploads ]; then
    chown -R nodejs:nodejs /app/uploads 2>/dev/null || CAN_CHOWN=false
fi

# Execute the main command
# If chown succeeded, run as nodejs user for security
# If chown failed, run as root (needed for write access to mounted volumes)
if [ "$CAN_CHOWN" = "true" ]; then
    exec su-exec nodejs "$@"
else
    exec "$@"
fi
