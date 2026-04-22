#!/bin/sh
set -e

# Render passes the backend service hostname via BACKEND_HOST (fromService).
# Construct VITE_API_URL from it so the Vite build bakes the correct URL in.
if [ -z "$VITE_API_URL" ] && [ -n "$BACKEND_HOST" ]; then
  export VITE_API_URL="https://${BACKEND_HOST}/api"
fi

echo "Building frontend — VITE_API_URL=${VITE_API_URL:-/api}"
npm ci && npm run build
