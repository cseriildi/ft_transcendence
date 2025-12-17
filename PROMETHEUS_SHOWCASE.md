# Prometheus & Grafana Monitoring – User Guide

This guide walks you through how to view and demonstrate the monitoring setup using Prometheus and Grafana.

---

## Quick Links

- **Prometheus UI**: http://localhost:9090  
- **Grafana Dashboard**: http://localhost:3001  
  - Login: set in .env

---

## 1. Check Service Health

1. Open **Prometheus**
2. Go to **Status → Targets**

You should see **all targets marked UP (green)**:
- prometheus (self-monitoring)
- backend-database
- backend-gamelogic
- live-chat
- node-exporter

---

## 2. View Live Traffic & Performance

Go to the **Graph** tab in Prometheus.

### Request Rate (Traffic)
```promql
rate(http_requests_total[5m])
```
Shows how many requests per second each service is handling.

---

### Response Times (Latency)
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

---

## 3. WebSocket & Game Metrics

### Active WebSocket Connections
```promql
sum(ws_connections_active)
```

### Active Games
```promql
games_active
```

### Message Throughput
```promql
rate(ws_messages_total[1m]) * 60
```

---

## 4. System Resource Usage

### CPU Usage
```promql
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

### Memory Usage
```promql
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
```

### Disk Usage
```promql
(node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100
```

---

## 5. Alerts

Navigate to **Status → Rules** in Prometheus.

Preconfigured alerts include:
- ServiceDown
- HighErrorRate
- HighResponseTime
- HighMemoryUsage
- WebSocketConnectionDrop
