import { FastifyInstance } from "fastify";
import { userController } from "./userController.ts";
import { requireAuth } from "../../utils/authUtils.ts";
import { UserSchemas } from "./userSchemas.ts";
import { UserParams, UploadAvatarData } from "./userTypes.ts";
import { User, PublicUser, ApiResponse } from "../../types/commonTypes.ts";

async function userRoutes(fastify: FastifyInstance) {
  // GET /users/me - Get current authenticated user (must be BEFORE /users/:id)
  fastify.get<{ Reply: ApiResponse<User> }>(
    "/users/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Get current authenticated user's full profile",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.getCurrentUser,
      },
    },
    userController.getCurrentUser
  );

  // GET /users/:id - Get single user (protected, public profile - no 2FA status)
  fastify.get<{ Params: UserParams; Reply: ApiResponse<PublicUser> }>(
    "/users/:id",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Get user by ID - returns public profile without 2FA status (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.getUser,
      },
    },
    userController.getUserById
  );

  // GET /users - Get all users (public profiles - no 2FA status)
  fastify.get<{ Reply: ApiResponse<PublicUser[]> }>(
    "/users",
    {
      schema: {
        tags: ["users"],
        description: "Get all users - returns public profiles without 2FA status",
        ...UserSchemas.getUsers,
      },
    },
    userController.getUsers
  );

  // POST /users/avatar - Upload avatar (protected)
  fastify.post<{ Reply: ApiResponse<UploadAvatarData> }>(
    "/users/avatar",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description:
          "Upload avatar image (requires authentication, multipart/form-data).\
          After upload, avatars are publicly accessible at /uploads/avatars/{filename}",
        security: [{ bearerAuth: [] }],
        consumes: ["multipart/form-data"],
        ...UserSchemas.uploadAvatar,
      },
    },
    userController.uploadAvatar
  );

  // PATCH /users/:id/email - Change user email (protected)
  fastify.patch<{ Params: UserParams; Reply: ApiResponse<PublicUser> }>(
    "/users/:id/email",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Change user email (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.changeEmail,
      },
    },
    userController.changeEmail
  );

  // PATCH /users/:id/username - Change username (protected)
  fastify.patch<{ Params: UserParams; Reply: ApiResponse<PublicUser> }>(
    "/users/:id/username",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Change username (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.changeUsername,
      },
    },
    userController.changeUsername
  );

  // PATCH /users/:id/heartbeat - Update user's online status (protected)
  fastify.patch<{ Params: UserParams; Reply: ApiResponse<{ last_seen: string }> }>(
    "/users/:id/heartbeat",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["users"],
        description: "Update user's last seen timestamp (requires authentication)",
        security: [{ bearerAuth: [] }],
        ...UserSchemas.heartbeat,
      },
    },
    userController.updateHeartbeat
  );
}

export default userRoutes;
