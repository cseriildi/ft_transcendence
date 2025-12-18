# Useful KQL Queries

### Basic Filtering

#### Filter by Service
```kql
service: "database"
service: "live-chat"
service: "backend_gamelogic"
service: "frontend"
```

#### Filter by HTTP Status Code
```kql
app.res.statusCode: 200
app.res.statusCode >= 400
app.res.statusCode: (404 or 500)
```

#### Filter by Log Level
```kql
app.level: 30          # Info
app.level: 40          # Warn
app.level >= 40        # Warn and above
app.level_name: "error"
```

#### Filter by HTTP Method
```kql
app.req.method: "GET"
app.req.method: "POST"
http_method: "DELETE"
```

### Advanced Queries

#### Errors and Warnings Only
```kql
app.level >= 40
```

#### Slow Requests (> 1000ms)
```kql
app.responseTime > 1000
```

#### 404 Errors from Specific Service
```kql
service: "database" and app.res.statusCode: 404
```

#### Failed Authentication Attempts
```kql
app.msg: *authentication* and app.level: 50
```

#### Requests from Specific IP
```kql
client_ip: "172.18.0.5"
```

#### Requests to Specific Endpoint
```kql
app.req.url: "/metrics"
http_url: "/api/users*"
```

#### Exclude Health Checks
```kql
not app.req.url: "/health"
```

#### Time-Based Queries
```kql
@timestamp >= "now-1h"
@timestamp >= "2025-12-17T00:00:00" and @timestamp < "2025-12-17T23:59:59"
```

### Complex Queries

#### Production Errors in Last Hour
```kql
environment: "production" and app.level >= 50 and @timestamp >= "now-1h"
```

#### Slow Database Requests
```kql
service: "database" and app.responseTime > 500
```

#### Client Errors (4xx) Excluding 404
```kql
app.res.statusCode >= 400 and app.res.statusCode < 500 and not app.res.statusCode: 404
```

#### Multiple Services with Errors
```kql
(service: "database" or service: "live-chat") and app.level: 50
```
