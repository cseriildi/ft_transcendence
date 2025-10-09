import { SignJWT, jwtVerify } from "jose";
import crypto from "node:crypto";
import { errors } from "./errorUtils.ts";
import { JwtPayload } from "../services/authService/authTypes.ts";
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

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as unknown as JwtPayload;
  } catch {
    throw errors.unauthorized("Invalid or expired access token");
  }
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return payload as unknown as JwtPayload;
  } catch {
    throw errors.unauthorized("Invalid or expired refresh token");
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw errors.unauthorized("Access token required");
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  try {
    const payload = await verifyAccessToken(token);
    
    // Attach user info to request for use in handlers
    request.user = {
      id: parseInt(payload.sub!),
      sub: payload.sub!,
      jti: payload.jti,
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