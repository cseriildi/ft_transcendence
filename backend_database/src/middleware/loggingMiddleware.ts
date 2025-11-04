import { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from "fastify";

interface LogData {
  method: string;
  url: string;
  userAgent?: string;
  ip?: string;
  userId?: number;
  statusCode?: number;
  responseTime?: string;
}

/**
 * Logs incoming requests with method, URL, and user context
 */
export async function requestLogger(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const userId = request.user?.id;
  const logData: LogData = {
    method: request.method,
    url: request.url,
    userAgent: request.headers["user-agent"],
    ip: request.ip,
  };

  if (userId) {
    logData.userId = userId;
  }

  request.log.info(logData, "Incoming request");
}

/**
 * Logs outgoing responses with status code
 * Note: Response time is automatically logged by Fastify
 */
export function responseLogger(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const userId = request.user?.id;

  const logData: LogData = {
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
  };

  if (userId) {
    logData.userId = userId;
  }

  // Log level based on status code
  if (reply.statusCode >= 500) {
    request.log.error(logData, "Request failed");
  } else if (reply.statusCode >= 400) {
    request.log.warn(logData, "Request error");
  } else {
    request.log.info(logData, "Request completed");
  }

  done();
}

/**
 * Helper to create structured log entries with consistent context
 */
export function logWithContext(
  request: FastifyRequest,
  level: "info" | "warn" | "error",
  message: string,
  metadata?: Record<string, unknown>
): void {
  const logData = {
    userId: request.user?.id,
    url: request.url,
    method: request.method,
    ...metadata,
  };

  request.log[level](logData, message);
}
