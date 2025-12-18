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

# Optional: remove existing indices that were created before templates were applied.
# This helps avoid mapping conflicts for dev/eval environments where old indices
# contain wrong mappings (plain `text` for `service`) which break Kibana
# aggregations. This deletion runs by default; set DELETE_OLD_INDICES=0 to skip.
if [ "${DELETE_OLD_INDICES:-1}" != "0" ]; then
  log "🧹 Checking for existing indices to delete (pattern: ${DELETE_INDEX_PATTERN:-transcendence-logs-*})"
  IDX_PATTERN="${DELETE_INDEX_PATTERN:-transcendence-logs-*}"
  # Support basic auth if provided via ELASTICSEARCH_USER / ELASTICSEARCH_PASS
  AUTH_OPTS=""
  if [ -n "${ELASTICSEARCH_USER:-}" ]; then
    AUTH_OPTS="-u${ELASTICSEARCH_USER}:${ELASTICSEARCH_PASS:-}"
  fi
  idxs=$(curl -sS ${AUTH_OPTS} "${ELASTICSEARCH_HOST}/_cat/indices/${IDX_PATTERN}?h=index" || true)
  if [ -n "${idxs// /}" ]; then
    for idx in $idxs; do
      log "→ Deleting index: $idx"
      curl -sS ${AUTH_OPTS} -XDELETE "${ELASTICSEARCH_HOST}/${idx}" || log "⚠️  Failed to delete ${idx} (continuing)"
    done
    log "✅ Old indices (if any) deleted"
  else
    log "ℹ️  No matching old indices found"
  fi
else
  log "ℹ️  Skipping deletion of old indices (DELETE_OLD_INDICES=0)"
fi

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
        "@version": { "type": "keyword" },
        "service": { "type": "keyword" },
        "environment": { "type": "keyword" },
        "application": { "type": "keyword" },
        "container_name": { "type": "keyword" },
        "container_id": { "type": "keyword" },
        "syslog_hostname": { "type": "keyword" },
        "syslog_pid": { "type": "keyword" },
        "syslog_pri": { "type": "keyword" },
        "syslog_timestamp": { "type": "keyword" },
        "http_method": { "type": "keyword" },
        "http_url": { "type": "keyword" },
        "http_status_code": { "type": "keyword" },
        "request_id": { "type": "keyword" },
        "user_id": { "type": "keyword" },
        "client_ip": { "type": "ip" },
        "type": { "type": "keyword" },
        "log_message": { "type": "text" },
        "message": {
          "type": "text",
          "fields": {
            "keyword": { "type": "keyword", "ignore_above": 256 }
          }
        },
        "event": {
          "properties": {
            "original": {
              "type": "text",
              "fields": {
                "keyword": { "type": "keyword", "ignore_above": 8192 }
              }
            }
          }
        },
        "app": {
          "properties": {
            "level": { "type": "integer" },
            "level_name": { "type": "keyword" },
            "time": { "type": "long" },
            "pid": { "type": "integer" },
            "hostname": { "type": "keyword" },
            "reqId": { "type": "keyword" },
            "msg": {
              "type": "text",
              "fields": { "keyword": { "type": "keyword", "ignore_above": 512 } }
            },
            "responseTime": { "type": "float" },
            "req": {
              "properties": {
                "method": { "type": "keyword" },
                "url": { "type": "keyword" },
                "host": { "type": "keyword" },
                "remoteAddress": { "type": "ip" },
                "remotePort": { "type": "integer" },
                "userId": { "type": "keyword" }
              }
            },
            "res": {
              "properties": {
                "statusCode": { "type": "integer" }
              }
            },
            "err": {
              "properties": {
                "type": { "type": "keyword" },
                "message": { "type": "text" },
                "stack": { "type": "text" }
              }
            }
          }
        }
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

# -----------------------------------------------------------------------------
# Fix existing indices that were created before the template was applied.
# If an index has `service` as plain `text` without a `keyword` subfield,
# Kibana aggregations will fail. As a safe fallback for existing data we
# enable `fielddata=true` on the `service` text field so aggregations work.
# This uses extra memory but is acceptable for evaluation/dev environments.
# -----------------------------------------------------------------------------
log "⚙️  Checking existing indices for `service` mapping"
idxs=$(curl -sS "${ELASTICSEARCH_HOST}/_cat/indices/transcendence-logs-*?h=index" || true)
if [ -n "${idxs// /}" ]; then
  for idx in $idxs; do
    log "🔎 Inspecting index: $idx"
    svc_mapping=$(curl -sS "${ELASTICSEARCH_HOST}/${idx}/_mapping" || true)
    # If mapping contains a keyword subfield for service, skip
    if echo "$svc_mapping" | grep -q '"service".*"keyword"'; then
      log "✔️  Index $idx already has a keyword subfield for 'service'"
      continue
    fi
    # Otherwise set fielddata=true on the service text field to allow aggregations
    log "⚠️  Enabling fielddata on 'service' for index $idx (may use significant memory)"
    curl -sS -X PUT "${ELASTICSEARCH_HOST}/${idx}/_mapping" -H 'Content-Type: application/json' -d '{"properties": {"service": {"type":"text","fielddata": true}}}' >/dev/null 2>&1 || \
      log "❌ Could not update mapping for $idx -- you may need to reindex with the correct template"
  done
else
  log "ℹ️  No existing transcendence indices found to inspect"
fi

./elk/kibana-setup.sh
log "✅ ELK setup complete"
