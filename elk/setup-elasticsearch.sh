#!/usr/bin/env bash
set -euo pipefail

ELASTICSEARCH_HOST="${ELASTICSEARCH_HOST:-http://localhost:9200}"

log() { printf '%s\n' "$*"; }

wait_for_es() {
  log "⏳ Waiting for Elasticsearch..."
  until curl -fsS "${ELASTICSEARCH_HOST}/_cluster/health" >/dev/null 2>&1; do
    sleep 2
  done
  log "✅ Elasticsearch is ready"
}

es_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local allow_regex="${4:-}"

  local tmp
  tmp="$(mktemp)"
  local code

  if [[ -n "$data" ]]; then
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      -H 'Content-Type: application/json' \
      "${ELASTICSEARCH_HOST}${path}" \
      -d "$data" || true)"
  else
    code="$(curl -sS -o "$tmp" -w "%{http_code}" -X "$method" \
      "${ELASTICSEARCH_HOST}${path}" || true)"
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

wait_for_es

# ILM policy
log "⚙️  Ensuring ILM policy..."
es_request "PUT" "/_ilm/policy/transcendence-logs-policy" '{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": { "max_primary_shard_size": "50gb", "max_age": "7d" },
          "set_priority": { "priority": 100 }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "set_priority": { "priority": 50 },
          "forcemerge": { "max_num_segments": 1 },
          "shrink": { "number_of_shards": 1 }
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "set_priority": { "priority": 0 },
          "freeze": {}
        }
      },
      "delete": {
        "min_age": "90d",
        "actions": { "delete": {} }
      }
    }
  }
}'
log "✅ ILM policy ready"

# Index template
log "⚙️  Ensuring index template..."
es_request "PUT" "/_index_template/transcendence-logs-template" '{
  "index_patterns": ["transcendence-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "transcendence-logs-policy",
      "index.lifecycle.rollover_alias": "transcendence-logs",
      "index.refresh_interval": "5s",
      "index.codec": "best_compression"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "service": { "type": "keyword" },
        "container_id": { "type": "keyword" },
        "request_id": { "type": "keyword" },
        "user_id": { "type": "keyword" },
        "environment": { "type": "keyword" },
        "application": { "type": "keyword" },
        "app": {
          "properties": {
            "level": { "type": "integer" },
            "level_name": { "type": "keyword" },
            "msg": {
              "type": "text",
              "fields": { "keyword": { "type": "keyword", "ignore_above": 256 } }
            },
            "hostname": { "type": "keyword" },
            "pid": { "type": "integer" },
            "reqId": { "type": "keyword" }
          }
        },
        "http_method": { "type": "keyword" },
        "http_url": { "type": "keyword" },
        "http_status_code": { "type": "integer" },
        "client_ip": { "type": "ip" }
      }
    }
  },
  "priority": 500,
  "composed_of": [],
  "version": 1,
  "_meta": { "description": "Template for ft_transcendence application logs" }
}'
log "✅ Index template ready"

log "⚙️  Ensuring initial write index + alias..."
es_request "PUT" "/transcendence-logs-000001" '{
  "aliases": { "transcendence-logs": { "is_write_index": true } }
}' '^(200|201|204|400)$'
log "✅ Write index ready"

log "⚙️  Running Kibana setup..."
./elk/kibana-setup.sh
log "✅ ELK setup complete"
