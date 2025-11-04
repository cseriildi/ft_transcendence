#!/bin/sh
set -e

# Create data directory if it doesn't exist and set permissions
mkdir -p /app/data

# Try to set permissions, but continue if it fails
# (this can fail on mounted volumes with different owners)
# In that case, we'll run as root instead of nodejs user
CAN_CHOWN=true
chown -R nodejs:nodejs /app/data 2>/dev/null || CAN_CHOWN=false
chmod -R 755 /app/data 2>/dev/null || true

# Execute the main command
# If chown succeeded, run as nodejs user for security
# If chown failed, run as root (needed for write access to mounted volumes)
if [ "$CAN_CHOWN" = "true" ]; then
    exec su-exec nodejs "$@"
else
    exec "$@"
fi
