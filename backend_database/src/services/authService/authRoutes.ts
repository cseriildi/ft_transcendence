import { FastifyInstance } from "fastify";
import { authController } from "./authController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { AuthSchemas } from "./authSchemas.ts";
import { CreateUserBody, CreateUserResponse, UserLoginBody, UserLoginResponse } from "./authTypes.ts";

async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post<{ Body: CreateUserBody; Reply: CreateUserResponse }>(
    "/register",
    {
      schema: {
        tags: ["auth"],
        description: "Register a new user account",
        ...AuthSchemas.register
      }
    },
    authController.createUser
  );

  // POST /auth/login
  fastify.post<{ Body: UserLoginBody; Reply: UserLoginResponse }>(
    "/login",
    {
      schema: {
        tags: ["auth"],
        description: "Login with email and password",
        ...AuthSchemas.login
      }
    },
    authController.loginUser
  );

  // POST /auth/refresh
  fastify.post<{ Reply: UserLoginResponse }>(
    "/refresh",
    {
      schema: {
        tags: ["auth"],
        description: "Refresh access token using refresh token cookie",
        ...AuthSchemas.refresh
      }
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
        ...AuthSchemas.logout
      }
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
        ...AuthSchemas.verify
      }
    },
    authController.verifyToken
  );
}

export default authRoutes;