#!/usr/bin/env bash
# Quick index template setup (runs before application services start)
set -euo pipefail

ELASTICSEARCH_HOST="${ELASTICSEARCH_HOST:-http://localhost:9200}"

echo "⚙️  Creating index template..."

curl -X PUT "${ELASTICSEARCH_HOST}/_index_template/transcendence-logs-template" \
  -H 'Content-Type: application/json' \
  -d '{
  "index_patterns": ["transcendence-logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.refresh_interval": "5s"
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
  "priority": 500
}' > /dev/null 2>&1 && echo "✅ Index template created" || echo "⚠️  Template creation failed (may already exist)"
