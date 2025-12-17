import "fastify";
import * as promClient from "prom-client";

declare module "fastify" {
  interface FastifyInstance {
    metrics?: {
      httpRequestDuration: promClient.Histogram;
      httpRequestsTotal: promClient.Counter;
      httpRequestsInFlight: promClient.Gauge;
      httpResponseSizeBytes: promClient.Histogram;
      wsConnectionsTotal: promClient.Counter;
      wsConnectionsActive: promClient.Gauge;
      wsMessagesTotal: promClient.Counter;
      gamesTotal: promClient.Counter;
      gamesActive: promClient.Gauge;
    };
  }
}
