import fastifyPlugin from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import * as promClient from "prom-client";

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (process metrics, gc, etc.)
promClient.collectDefaultMetrics({ register, prefix: "transcendence_" });

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestsInFlight = new promClient.Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently being processed",
  registers: [register],
});

const httpResponseSize = new promClient.Histogram({
  name: "http_response_size_bytes",
  help: "Size of HTTP responses in bytes",
  labelNames: ["method", "route", "status_code"],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

// WebSocket metrics (if applicable)
const websocketConnectionsActive = new promClient.Gauge({
  name: "websocket_connections_active",
  help: "Number of active WebSocket connections",
  registers: [register],
});

const websocketMessagesTotal = new promClient.Counter({
  name: "websocket_messages_total",
  help: "Total number of WebSocket messages",
  labelNames: ["direction", "type"],
  registers: [register],
});

const websocketErrorsTotal = new promClient.Counter({
  name: "websocket_errors_total",
  help: "Total number of WebSocket errors",
  labelNames: ["error_type"],
  registers: [register],
});

// Database metrics
const databaseQueriesTotal = new promClient.Counter({
  name: "database_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"],
  registers: [register],
});

const databaseQueryDuration = new promClient.Histogram({
  name: "database_query_duration_seconds",
  help: "Duration of database queries in seconds",
  labelNames: ["operation", "table"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// Authentication metrics
const authAttemptsTotal = new promClient.Counter({
  name: "auth_attempts_total",
  help: "Total number of authentication attempts",
  labelNames: ["method", "success"],
  registers: [register],
});

async function prometheusPlugin(fastify: FastifyInstance) {
  // Hook to measure request duration and count
  fastify.addHook("onRequest", async (request, reply) => {
    request.startTime = Date.now();
    httpRequestsInFlight.inc();
  });

  fastify.addHook("onResponse", async (request, reply) => {
    const duration = (Date.now() - (request.startTime || Date.now())) / 1000;
    const labels = {
      method: request.method,
      route: request.routeOptions?.url || request.url,
      status_code: reply.statusCode.toString(),
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
    httpRequestsInFlight.dec();

    // Measure response size if available
    const contentLength = reply.getHeader("content-length");
    if (contentLength) {
      httpResponseSize.observe(labels, parseInt(contentLength.toString(), 10));
    }
  });

  // Metrics endpoint
  fastify.get("/metrics", async (request, reply) => {
    reply.type("text/plain");
    return register.metrics();
  });

  // Decorate fastify with metrics for use in routes
  fastify.decorate("metrics", {
    httpRequestDuration,
    httpRequestsTotal,
    httpRequestsInFlight,
    httpResponseSize,
    websocketConnectionsActive,
    websocketMessagesTotal,
    websocketErrorsTotal,
    databaseQueriesTotal,
    databaseQueryDuration,
    authAttemptsTotal,
  });
}

export default fastifyPlugin(prometheusPlugin, {
  name: "prometheus-metrics",
  fastify: "5.x",
});

// Export metrics for use in other modules
export {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  httpRequestsInFlight,
  httpResponseSize,
  websocketConnectionsActive,
  websocketMessagesTotal,
  websocketErrorsTotal,
  databaseQueriesTotal,
  databaseQueryDuration,
  authAttemptsTotal,
};
