import { Database } from "sqlite3";
import { AccessTokenPayload } from "../services/authService/authTypes.ts";
import type { Counter, Histogram, Gauge } from "prom-client";

// Extend Fastify's types globally
declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    metrics: {
      httpRequestDuration: Histogram;
      httpRequestsTotal: Counter;
      httpRequestsInFlight: Gauge;
      httpResponseSize: Histogram;
      websocketConnectionsActive: Gauge;
      websocketMessagesTotal: Counter;
      websocketErrorsTotal: Counter;
      databaseQueriesTotal: Counter;
      databaseQueryDuration: Histogram;
      authAttemptsTotal: Counter;
    };
  }
  interface FastifyRequest {
    // User is populated from access token (which has no JTI)
    user?: AccessTokenPayload & { id: number };
    // Set to true when request is authenticated via service token (internal service-to-service)
    isServiceRequest?: boolean;
    startTime?: number;
  }
}
