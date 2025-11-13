import { SignJWT, jwtVerify } from "jose";
// import crypto from "node:crypto"; // DISABLED: runtime environment does not provide node:crypto
import { errors } from "./errorUtils.ts";
import { AccessTokenPayload, RefreshTokenPayload } from "../services/authService/authTypes.ts";
import { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config.ts";

const ISSUER = config.jwt.issuer;
const AUDIENCE = config.jwt.audience;
const ACCESS_SECRET = new TextEncoder().encode(config.jwt.accessSecret);
const REFRESH_SECRET = new TextEncoder().encode(config.jwt.refreshSecret);
const ACCESS_TTL = config.jwt.accessTtl;
const REFRESH_TTL = config.jwt.refreshTtl;

// Fallback JTI generator when crypto.randomUUID() is unavailable.
// NOTE: This is less cryptographically strong than uuid/randomUUID but
// acceptable for environments without Node's crypto. If you deploy to
// environments with crypto available later, consider restoring randomUUID.
export const createJti = () => `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

export async function signAccessToken(userId: number) {
  const token = await new SignJWT({})
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
  const token = await new SignJWT({})
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

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as unknown as AccessTokenPayload;
  } catch {
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
    return payload as unknown as RefreshTokenPayload;
  } catch {
    throw errors.unauthorized("Invalid or expired refresh token", {
      function: "verifyRefreshToken",
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
    // Note: Access tokens don't have JTI (only refresh tokens do)
    request.user = {
      id: parseInt(payload.sub!),
      sub: payload.sub!,
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
