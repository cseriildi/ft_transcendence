import { FastifyInstance } from "fastify";
import { authController } from "./authController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { AuthSchemas } from "./authSchemas.ts";
import { CreateUserBody, UserLoginBody, AuthUserData } from "./authTypes.ts";
import { ApiResponse } from "../../types/commonTypes.ts";

async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post<{ Body: CreateUserBody; Reply: ApiResponse<AuthUserData> }>(
    "/register",
    {
      schema: {
        tags: ["auth"],
        description: "Register a new user account",
        ...AuthSchemas.register,
      },
    },
    authController.createUser
  );

  // POST /auth/login
  fastify.post<{ Body: UserLoginBody; Reply: ApiResponse<AuthUserData> }>(
    "/login",
    {
      schema: {
        tags: ["auth"],
        description: "Login with email and password",
        ...AuthSchemas.login,
      },
    },
    authController.loginUser
  );

  // POST /auth/login/2fa
  fastify.post<{
    Body: { tempToken: string; twofa_token: string };
    Reply: ApiResponse<AuthUserData>;
  }>(
    "/login/2fa",
    {
      schema: {
        tags: ["auth"],
        description: "Complete login with 2FA verification (second step after /login)",
        ...AuthSchemas.login2FA,
      },
    },
    authController.login2FA
  );

  // POST /auth/refresh
  fastify.post<{ Reply: ApiResponse<AuthUserData> }>(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        description: "Refresh access token using refresh token cookie",
        ...AuthSchemas.refresh,
      },
    },
    authController.refresh
  );

  // POST /auth/logout
  fastify.post(
    "/logout",
    {
      schema: {
        tags: ["auth"],
        description: "Logout user and revoke refresh token",
        ...AuthSchemas.logout,
      },
    },
    authController.logout
  );

  // GET /auth/verify
  fastify.get(
    "/verify",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["auth"],
        description: "Verify access token validity (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...AuthSchemas.verify,
      },
    },
    authController.verifyToken
  );
}

export default authRoutes;
