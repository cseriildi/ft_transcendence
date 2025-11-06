#!/bin/bash
# Dev environment loader for local development and devcontainers
# Sources .env.development if it exists

ENV_FILE="${1:-.env.development}"

if [ -f "$ENV_FILE" ]; then
  echo "📦 Loading environment from $ENV_FILE"
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "⚠️  Warning: $ENV_FILE not found"
  echo "Please ensure environment variables are set"
fi

# Execute the command passed as arguments
exec "${@:2}"
