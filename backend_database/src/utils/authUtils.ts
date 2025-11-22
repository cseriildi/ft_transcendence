import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { errors } from "./errorUtils.ts";
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  TempTokenPayload,
} from "../services/authService/authTypes.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.ts";

const ISSUER = config.jwt.issuer;
const AUDIENCE = config.jwt.audience;
const ACCESS_SECRET = new TextEncoder().encode(config.jwt.accessSecret);
const REFRESH_SECRET = new TextEncoder().encode(config.jwt.refreshSecret);
const ACCESS_TTL = config.jwt.accessTtl;
const REFRESH_TTL = config.jwt.refreshTtl;

export const createJti = () => crypto.randomUUID();

export async function signAccessToken(userId: number) {
  const token = await new SignJWT({ type: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(ACCESS_SECRET);
  return token;
}

export async function signRefreshToken(userId: number, jti: string) {
  const token = await new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setJti(jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TTL)
    .sign(REFRESH_SECRET);
  return token;
}

export async function signTemporaryToken(userId: number): Promise<string> {
  const token = await new SignJWT({ type: "temp_2fa" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(String(userId))
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m") // 5 minutes only
    .sign(ACCESS_SECRET);
  return token;
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const typedPayload = payload as unknown as AccessTokenPayload;

    // Verify this is actually an access token, not a temp token
    if (typedPayload.type !== "access") {
      throw errors.unauthorized("Invalid token type", {
        expected: "access",
        received: typedPayload.type,
      });
    }

    return typedPayload;
  } catch (error) {
    // If it's our own validation error, rethrow it with original context
    if (error instanceof Error && error.message.includes("Invalid token type")) {
      throw error;
    }
    // Otherwise, it's a jose verification error - wrap with function context
    throw errors.unauthorized("Invalid or expired access token", {
      function: "verifyAccessToken",
    });
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const typedPayload = payload as unknown as RefreshTokenPayload;

    // Verify this is actually a refresh token
    if (typedPayload.type !== "refresh") {
      throw errors.unauthorized("Invalid token type", {
        expected: "refresh",
        received: typedPayload.type,
      });
    }

    return typedPayload;
  } catch (error) {
    // If it's our own validation error, rethrow it with original context
    if (error instanceof Error && error.message.includes("Invalid token type")) {
      throw error;
    }
    // Otherwise, it's a jose verification error - wrap with function context
    throw errors.unauthorized("Invalid or expired refresh token", {
      function: "verifyRefreshToken",
    });
  }
}

export async function verifyTemporaryToken(token: string): Promise<TempTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    const typedPayload = payload as unknown as TempTokenPayload;

    // Verify this is actually a temporary 2FA token
    if (typedPayload.type !== "temp_2fa") {
      throw errors.unauthorized("Invalid token type", {
        expected: "temp_2fa",
        received: typedPayload.type,
      });
    }

    return typedPayload;
  } catch (error) {
    // If it's our own validation error, rethrow it with original context
    if (error instanceof Error && error.message.includes("Invalid token type")) {
      throw error;
    }
    // Otherwise, it's a jose verification error - wrap with function context
    throw errors.unauthorized("Invalid or expired temporary token", {
      function: "verifyTemporaryToken",
    });
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw errors.unauthorized("Access token required", {
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader?.substring(0, 7),
      middleware: "requireAuth",
    });
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const payload = await verifyAccessToken(token);

    // Attach user info to request for use in handlers
    request.user = {
      id: parseInt(payload.sub!),
      sub: payload.sub!,
      type: payload.type,
      iat: payload.iat,
      exp: payload.exp,
      iss: payload.iss,
      aud: payload.aud,
    };
  } catch (error) {
    // verifyAccessToken already throws errors.unauthorized
    throw error;
  }
}

/**
 * Validates that the authenticated user matches the requested resource ID
 * Throws forbidden error if IDs don't match
 */
export function ensureUserOwnership(tokenUserId: number, resourceId: string | number) {
  const numericResourceId = typeof resourceId === "string" ? parseInt(resourceId) : resourceId;
  if (tokenUserId !== numericResourceId) {
    throw errors.forbidden("Token Subject-ID does not match user ID of requested Resource", {
      tokenUserId,
      requestedResourceId: numericResourceId,
      function: "ensureUserOwnership",
    });
  }
}

/**
 * Sets a refresh token cookie with standard secure settings
 *
 * Security features:
 * - httpOnly: Prevents JavaScript access (XSS protection)
 * - secure: HTTPS-only in production
 * - sameSite: 'strict' prevents CSRF attacks
 * - path: Scoped to /auth endpoints only
 *
 * Important: sameSite: "strict" assumes same-origin deployment
 * (frontend and backend on same domain). If frontend is on a different
 * origin (e.g., frontend.com calling api.backend.com), use "lax" instead.
 * For this project, frontend and backend are served from the same origin.
 */
export function setRefreshTokenCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // CSRF protection - only sent to same origin
    path: "/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  });
}

export async function generateAndStoreRefreshToken(
  db: { run: (sql: string, params: unknown[]) => Promise<{ lastID: number; changes: number }> },
  userId: number
): Promise<string> {
  const jti = createJti();
  const refreshToken = await signRefreshToken(userId, jti);
  const refreshHash = await (await import("bcrypt")).default.hash(refreshToken, 10);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.run(
    "INSERT INTO refresh_tokens (jti, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    [jti, userId, refreshHash, expiresAt]
  );

  return refreshToken;
}
