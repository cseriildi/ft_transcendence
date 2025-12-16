#!/usr/bin/env bash
set -euo pipefail

KIBANA_HOST="${KIBANA_HOST:-http://localhost:5601}"

log() { printf '%s\n' "$*"; }

wait_for_kibana() {
  log "⏳ Waiting for Kibana..."
  local i=0
  until curl -fsS "$KIBANA_HOST/api/status" >/dev/null 2>&1; do
    i=$((i+1))
    printf '.'
    sleep 2
    if [ "$i" -ge 90 ]; then
      printf '\n'
      log "❌ Kibana did not become ready in time"
      exit 1
    fi
  done
  printf '\n'
  log "✅ Kibana is ready"
}

kb_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local allow_regex="${4:-}"

  local tmp code
  tmp="$(mktemp)"

  if [[ -n "$data" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
      "$KIBANA_HOST$path" -d "$data" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H 'kbn-xsrf: true' \
      "$KIBANA_HOST$path" || true)"
  fi

  if [[ -z "$allow_regex" ]]; then
    allow_regex='^(200|201|204)$'
  fi

  if [[ "$code" =~ $allow_regex ]]; then
    rm -f "$tmp"
    return 0
  fi

  log "❌ Request failed: ${method} ${path} (HTTP ${code})"
  log "---- response body ----"
  cat "$tmp" || true
  log "-----------------------"
  rm -f "$tmp"
  return 1
}

wait_for_kibana

# -----------------------------------------------------------------------------
# Index pattern (data view)
# -----------------------------------------------------------------------------
log "⚙️  Ensuring index pattern..."
kb_request "POST" "/api/saved_objects/index-pattern/transcendence-logs" '{
  "attributes": {
    "title": "transcendence-logs-*",
    "timeFieldName": "@timestamp",
    "fields": "[]"
  }
}' '^(200|201|204|409)$'
log "✅ Index pattern ready"

log "⚙️  Setting default index pattern..."
kb_request "POST" "/api/kibana/settings/defaultIndex" '{
  "value": "transcendence-logs"
}'
log "✅ Default index set"

# -----------------------------------------------------------------------------
# Saved searches (use POST to create; if exists, Kibana may return 409)
# -----------------------------------------------------------------------------
log "⚙️  Ensuring saved searches..."

# Error Logs
kb_request "POST" "/api/saved_objects/search/transcendence-search-error-logs?overwrite=true" '{
  "attributes": {
    "title": "Error Logs",
    "description": "All error and fatal level logs",
    "columns": ["service", "app.msg", "http_method", "http_url", "http_status_code"],
    "sort": [["@timestamp", "desc"]],
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query_string\":{\"query\":\"app.level_name:(error OR fatal)\"}},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [
    { "id": "transcendence-logs", "name": "kibanaSavedObjectMeta.searchSourceJSON.index", "type": "index-pattern" }
  ]
}' '^(200|201|204|409)$'

# HTTP Errors
kb_request "POST" "/api/saved_objects/search/transcendence-search-http-errors?overwrite=true" '{
  "attributes": {
    "title": "HTTP Errors (4xx & 5xx)",
    "description": "HTTP requests with error status codes",
    "columns": ["service", "http_method", "http_url", "http_status_code", "user_id", "client_ip"],
    "sort": [["@timestamp", "desc"]],
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query_string\":{\"query\":\"http_status_code:>=400\"}},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [
    { "id": "transcendence-logs", "name": "kibanaSavedObjectMeta.searchSourceJSON.index", "type": "index-pattern" }
  ]
}' '^(200|201|204|409)$'

# Authentication Events
kb_request "POST" "/api/saved_objects/search/transcendence-search-auth-events?overwrite=true" '{
  "attributes": {
    "title": "Authentication Events",
    "description": "Login, logout, and registration events",
    "columns": ["app.msg", "user_id", "client_ip", "http_status_code"],
    "sort": [["@timestamp", "desc"]],
    "kibanaSavedObjectMeta": {
      "searchSourceJSON": "{\"query\":{\"query_string\":{\"query\":\"app.msg:(*login* OR *logout* OR *register* OR *authentication*)\"}},\"filter\":[],\"indexRefName\":\"kibanaSavedObjectMeta.searchSourceJSON.index\"}"
    }
  },
  "references": [
    { "id": "transcendence-logs", "name": "kibanaSavedObjectMeta.searchSourceJSON.index", "type": "index-pattern" }
  ]
}' '^(200|201|204|409)$'
log "✅ Saved searches ready"

# -----------------------------------------------------------------------------
# Dashboard import
# -----------------------------------------------------------------------------
log "⚙️  Importing dashboard (if present)..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASHBOARD_FILE="$SCRIPT_DIR/kibana/dashboards/transcendence-overview.ndjson"

if [ ! -f "$DASHBOARD_FILE" ]; then
  log "ℹ️  Dashboard file not found, skipping import"
else
  resp="$(curl -sS -X POST "$KIBANA_HOST/api/saved_objects/_import?overwrite=true" \
    -H "kbn-xsrf: true" \
    --form file=@"$DASHBOARD_FILE" || true)"

  if echo "$resp" | grep -q '"success":true'; then
    log "✅ Dashboard imported"
  else
    log "⚠️  Dashboard import did not report success:"
    echo "$resp"
    exit 1
  fi
fi

log "✅ Kibana setup complete"
