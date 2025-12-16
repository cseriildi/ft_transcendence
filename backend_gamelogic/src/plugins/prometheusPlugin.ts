import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register });

// HTTP Metrics
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestsInFlight = new client.Gauge({
  name: "http_requests_in_flight",
  help: "Number of HTTP requests currently being processed",
  registers: [register],
});

const httpResponseSizeBytes = new client.Histogram({
  name: "http_response_size_bytes",
  help: "Size of HTTP responses in bytes",
  labelNames: ["method", "route", "status_code"],
  buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
  registers: [register],
});

// WebSocket Metrics
const wsConnectionsTotal = new client.Counter({
  name: "ws_connections_total",
  help: "Total number of WebSocket connections",
  labelNames: ["status"],
  registers: [register],
});

const wsConnectionsActive = new client.Gauge({
  name: "ws_connections_active",
  help: "Number of active WebSocket connections",
  registers: [register],
});

const wsMessagesTotal = new client.Counter({
  name: "ws_messages_total",
  help: "Total number of WebSocket messages",
  labelNames: ["direction", "type"],
  registers: [register],
});

// Game Metrics
const gamesTotal = new client.Counter({
  name: "games_total",
  help: "Total number of games started",
  labelNames: ["mode"],
  registers: [register],
});

const gamesActive = new client.Gauge({
  name: "games_active",
  help: "Number of active games",
  registers: [register],
});

async function prometheusPlugin(app: FastifyInstance) {
  // Track request timing using WeakMap to avoid type issues
  const requestStartTimes = new WeakMap<FastifyRequest, number>();

  // Add hook to track request duration
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    httpRequestsInFlight.inc();
    requestStartTimes.set(request, Date.now());
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    httpRequestsInFlight.dec();

    const startTime = requestStartTimes.get(request);
    if (startTime) {
      const duration = (Date.now() - startTime) / 1000;
      const route = request.routeOptions?.url || request.url;
      const statusCode = reply.statusCode.toString();

      httpRequestDuration.observe({ method: request.method, route, status_code: statusCode }, duration);
      httpRequestsTotal.inc({ method: request.method, route, status_code: statusCode });

      // Track response size if available
      const contentLength = reply.getHeader("content-length");
      if (contentLength) {
        httpResponseSizeBytes.observe(
          { method: request.method, route, status_code: statusCode },
          parseInt(contentLength as string, 10),
        );
      }
    }
  });

  // Metrics endpoint
  app.get("/metrics", async (request, reply) => {
    reply.type("text/plain");
    return register.metrics();
  });

  // Expose metrics via decorator
  app.decorate("metrics", {
    httpRequestDuration,
    httpRequestsTotal,
    httpRequestsInFlight,
    httpResponseSizeBytes,
    wsConnectionsTotal,
    wsConnectionsActive,
    wsMessagesTotal,
    gamesTotal,
    gamesActive,
  });
}

export default fp(prometheusPlugin, {
  name: "prometheus",
});
